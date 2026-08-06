import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  forbidden,
  handler,
  jsonOk,
  notFound,
  conflict,
  readJson,
  requireUser,
} from "@/lib/server/http";
import { serializeInvoice } from "@/lib/server/serialize";
import { assertTransition, recordTransition } from "@/lib/server/statusEvents";
import { invoiceHref, notify } from "@/lib/server/notify";
import { allocateDepositAddress } from "@/lib/server/gateway";
import { parseTerms, splitForAmount } from "@/lib/server/chain/gateway-contract";
import { assertRateWithinTolerance, referenceRate } from "@/lib/server/rates";
import { bankSpread } from "@/lib/server/ledger";
import { toRial } from "@/lib/server/money";
import { env } from "@/lib/server/env";
import { parseUnits } from "viem";
import { raisePayoutSettlement } from "@/lib/server/payout";
import { postInvoicePaid } from "@/lib/server/postings";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "@/lib/server/chain/verify";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Actor, InvoiceStatus, Role } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  // `role` is here so a notification can be pointed at the panel its recipient
  // actually has: each side reads the same invoice at a different route.
  owner: { select: { uid: true, fullName: true, role: true } },
  counterparty: { select: { uid: true, fullName: true, role: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

const Body = z.object({
  action: z.enum([
    "approve",
    "reject",
    // Import only, in order: the bank prices it and names the rial account,
    // confirms the importer's rial has landed, then funds the contract.
    "lockRate",
    "confirmRialDeposit",
    "startPayment",
    "confirmPayment",
    "expire",
    // Import only: calling it off once the bank is involved, and — when the
    // importer's rial had already landed — putting it back.
    "requestCancel",
    "cancel",
    "confirmRialReturn",
  ]),
  reason: z.string().trim().max(500).optional(),
  txHash: z.string().trim().optional(),
  rate: z.number().positive().optional(),
  depositAccount: z.string().trim().optional(),
  receiptNo: z.string().trim().optional(),
});

/**
 * The single write path for invoice status. Each action declares which statuses
 * it may run from, so a stale tab or a replayed request cannot move an invoice
 * backwards or approve one the admin already rejected.
 */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;
    const body = await readJson(request, Body);
    const { action, reason, txHash } = body;

    // Paying is no longer anonymous. An export brings currency into the
    // country, so the payer has to be the account the invoice was addressed to
    // — which is checked against the record below, not merely asserted here.
    const user = await requireUser();

    const invoice = await db.invoice.findFirst({
      where: { OR: [{ ref }, { trxRef: ref }] },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw notFound("فاکتور یافت نشد");

    const from = invoice.status;
    let to: InvoiceStatus;
    let actor: Actor;
    let data: Prisma.InvoiceUpdateInput = {};
    /**
     * `to` is whoever has to act next. On an export that is nearly always the
     * merchant who raised the invoice; on an import it alternates between the
     * foreign seller and the Iranian importer, and telling the wrong one is how
     * the importer never finds out they owe rial.
     */
    let recipientNote:
      | { title: string; body: string; kind: string; to?: "raiser" | "counterparty" | "both" }
      | null = null;
    /** How the deposit's contract divides the fee, once one has been read. */
    let share: { gateway: string; freezone: string } | undefined;

    switch (action) {
      case "approve": {
        if (user.role !== "ADMIN") throw forbidden("تأیید فاکتور فقط توسط ادمین انجام می‌شود");
        assertTransition(from, ["PENDING"], "تأیید فاکتور");
        to = "APPROVED";
        actor = "ADMIN";
        // Derived at approval, so an unapproved invoice never advertises
        // somewhere to send money — and derived per invoice, so whatever lands
        // there can only belong to this one. On an import the remainder is the
        // seller's, and the fee is pinned so they receive their exact figure.
        const importing = invoice.direction === "IMPORT";
        if (importing && !invoice.beneficiaryWallet) {
          throw badRequest("این فاکتور آدرس کیف پول فروشنده را ندارد");
        }
        data = {
          paymentAddress: await allocateDepositAddress(
            invoice.id,
            invoice.ref,
            db,
            importing
              ? {
                  beneficiary: invoice.beneficiaryWallet!,
                  fee: parseUnits((invoice.feeAmount ?? new Prisma.Decimal(0)).toString(), env().USDT_DECIMALS),
                }
              : undefined,
          ),
        };
        recipientNote = {
          kind: "INVOICE_APPROVED",
          title: "فاکتور تأیید شد",
          body:
            invoice.direction === "IMPORT"
              ? `فاکتور ${invoice.ref} توسط سازمان تأیید شد — بانک نرخ و شماره حساب را اعلام می‌کند`
              : `فاکتور ${invoice.ref} تأیید شد — لینک پرداخت را برای خریدار بفرستید`,
          to: "both",
        };
        break;
      }
      case "reject": {
        if (user.role !== "ADMIN") throw forbidden("رد فاکتور فقط توسط ادمین انجام می‌شود");
        assertTransition(from, ["PENDING", "APPROVED"], "رد فاکتور");
        if (!reason) throw badRequest("دلیل رد فاکتور الزامی است");
        to = "REJECTED";
        actor = "ADMIN";
        data = { rejectReason: reason };
        recipientNote = {
          kind: "INVOICE_REJECTED",
          title: "فاکتور رد شد",
          body: `فاکتور ${invoice.ref} رد شد: ${reason}`,
          to: "both",
        };
        break;
      }
      case "lockRate": {
        // Import only. The bank prices the currency it will supply and names
        // the account the importer pays the rial into — both reach the importer
        // together, so they see the sum and where to send it in one place.
        if (user.role !== "BANK") throw forbidden();
        if (invoice.direction !== "IMPORT") throw badRequest("این اقدام فقط برای واردات است");
        assertTransition(from, ["APPROVED"], "قفل نرخ");
        if (!body.rate) throw badRequest("نرخ ارز الزامی است");
        if (!body.depositAccount) throw badRequest("شماره حساب واریز ریالی الزامی است");
        await assertRateWithinTolerance(body.rate, invoice.currency);

        // The importer pays for the amount plus the fee, because that is what
        // the bank has to supply for the seller to receive their full figure.
        const gross = (invoice.netAmount ?? invoice.amount).add(invoice.feeAmount ?? 0);
        const spread = bankSpread({
          side: "sell",
          lockedRate: body.rate,
          referenceRate: await referenceRate(invoice.currency),
          tokenAmount: gross,
        });

        to = "BANK_RATE_LOCKED";
        actor = "BANK";
        // The window restarts here. Up to now the clock was measuring the
        // organization's and the bank's own review; from here it measures the
        // importer's time to wire rial against a rate the bank has committed
        // to, which is the only part of an import that has to be time-boxed.
        const settings = await db.settings.findUnique({ where: { id: 1 } });
        data = {
          exchangeRate: body.rate.toString(),
          rateLockedAt: new Date(),
          rialAmount: toRial(body.rate, gross),
          depositAccount: body.depositAccount,
          bankSpreadRial: spread,
          expiresAt: new Date(Date.now() + (settings?.importValidityHours ?? 72) * 3_600_000),
        };
        recipientNote = {
          kind: "INVOICE_RATE_LOCKED",
          title: "نرخ اعلام شد — منتظر واریز شما",
          body:
            `برای فاکتور ${invoice.ref} نرخ قفل شد — ` +
            `${toRial(body.rate, gross)} ریال به حساب ${body.depositAccount} واریز کنید`,
          // The importer is the one who owes the money. Telling the seller to
          // pay rial was the bug: they have none to pay, and the person who
          // does was never told.
          to: "counterparty",
        };
        break;
      }

      case "confirmRialDeposit": {
        if (user.role !== "BANK") throw forbidden();
        if (invoice.direction !== "IMPORT") throw badRequest("این اقدام فقط برای واردات است");
        assertTransition(from, ["BANK_RATE_LOCKED"], "تأیید واریز ریال");
        if (!body.receiptNo) throw badRequest("شماره رسید واریز الزامی است");
        to = "RIAL_RECEIVED";
        actor = "BANK";
        data = { rialReceiptNo: body.receiptNo, rialDepositAt: new Date() };
        recipientNote = {
          kind: "INVOICE_RIAL_RECEIVED",
          title: "واریز ریالی تأیید شد",
          body: `ریال فاکتور ${invoice.ref} دریافت شد — ارز در حال تأمین است`,
          to: "both",
        };
        break;
      }

      case "startPayment": {
        /**
         * Whoever owes the money pays it, in both directions.
         *
         * The invoice is raised by whoever is owed — the Iranian merchant
         * exporting, the foreign seller when importing — so the party who owes
         * is the counterparty either way. The bank used to make the import
         * payment itself, out of rial it had already taken; it no longer does.
         * Its job is to supply the currency and to price it, and the importer
         * pays the contract from their own wallet.
         */
        if (invoice.counterpartyId !== user.id) {
          throw forbidden("این فاکتور برای حساب دیگری صادر شده است");
        }
        assertTransition(
          from,
          invoice.direction === "IMPORT" ? ["RIAL_RECEIVED"] : ["APPROVED"],
          "شروع پرداخت",
        );
        // An import that has reached this point has had its rial taken and is
        // waiting on currency the bank supplies outside the system. Refusing on
        // a lapsed deadline would strand that money: the importer paid, and
        // nobody would be allowed to finish the trade or send it back.
        const deadlineApplies = invoice.direction !== "IMPORT";
        if (deadlineApplies && invoice.expiresAt && invoice.expiresAt.getTime() < Date.now()) {
          throw badRequest("مهلت پرداخت این فاکتور به پایان رسیده است");
        }
        to = "PAYMENT_PENDING";
        actor = "COUNTERPARTY";
        break;
      }
      case "confirmPayment": {
        // Whoever paid reports the hash. The deposit watcher does this on its
        // own when log scanning is available; this path lets a payment settle
        // without it, and is no less safe because the chain — not the caller —
        // supplies the amount and the recipient.
        if (invoice.counterpartyId !== user.id) {
          throw forbidden("این فاکتور برای حساب دیگری صادر شده است");
        }
        assertTransition(
          from,
          invoice.direction === "IMPORT"
            ? ["RIAL_RECEIVED", "PAYMENT_PENDING"]
            : ["APPROVED", "PAYMENT_PENDING"],
          "ثبت پرداخت",
        );
        if (!txHash) throw badRequest("هش تراکنش الزامی است");
        if (!invoice.paymentAddress) throw badRequest("آدرس پرداخت این فاکتور تعیین نشده است");

        // Importing, the fee rides on top of what the seller is owed, so the
        // importer has to send both. Accepting the principal alone would settle
        // the invoice while the contract paid the seller their own figure less
        // the fee.
        const required =
          invoice.direction === "IMPORT"
            ? invoice.amount.add(invoice.feeAmount ?? 0)
            : invoice.amount;

        let verified;
        try {
          verified = await verifyTransfer(txHash, {
            to: invoice.paymentAddress,
            currency: invoice.currency,
            minAmount: required.toString(),
          });
        } catch (error) {
          if (error instanceof ChainVerificationError) throw badRequest(error.message);
          throw error;
        }

        const chainTx = await recordChainTx(verified, "IN");
        if (chainTx.matchedAt) throw conflict("این تراکنش قبلاً برای فاکتور دیگری ثبت شده است");

        // Credit what actually arrived rather than what was invoiced, so an
        // overpayment reaches the merchant instead of being kept — and split it
        // by the terms this address was derived from, because the contract is
        // what will actually take the fee.
        const deposit = await db.depositAddress.findUnique({
          where: { invoiceId: invoice.id },
          select: { terms: true },
        });
        if (!deposit?.terms) throw badRequest("شرایط تسویه این فاکتور ثبت نشده است");
        const { fee, net, gateway, freezone } = splitForAmount(
          parseTerms(deposit.terms),
          verified.amount,
        );
        share = { gateway, freezone };

        to = "PAID";
        actor = "COUNTERPARTY";
        data = {
          chainTx: { connect: { id: chainTx.id } },
          paidAt: new Date(),
          receivedAmount: verified.amount,
          feeAmount: fee,
          netAmount: net,
        };
        recipientNote = {
          kind: "PAYMENT_RECEIVED",
          title: "پرداخت دریافت شد",
          body: `پرداخت فاکتور ${invoice.ref} روی شبکه تأیید شد`,
          to: "both",
        };
        break;
      }
      case "expire": {
        if (user.role !== "ADMIN") throw forbidden();
        assertTransition(from, ["PENDING", "APPROVED", "PAYMENT_PENDING"], "انقضای فاکتور");
        to = "EXPIRED";
        actor = "SYSTEM";
        recipientNote = {
          kind: "INVOICE_EXPIRED",
          title: "فاکتور منقضی شد",
          body: `مهلت پرداخت فاکتور ${invoice.ref} به پایان رسید`,
          to: "both",
        };
        break;
      }

      /**
       * Asking to call it off.
       *
       * Deliberately not a status change. The importer knows the deal is dead;
       * only the bank knows whether the currency has already left for the
       * seller. Letting either trader move the status themselves would race the
       * bank's transfer — so the party who is out of pocket gets to raise it
       * inside the system, and the decision stays where the facts are.
       */
      case "requestCancel": {
        if (invoice.direction !== "IMPORT") throw badRequest("این اقدام فقط برای واردات است");
        const isParty = invoice.ownerId === user.id || invoice.counterpartyId === user.id;
        if (!isParty && user.role !== "ADMIN") throw forbidden("این فاکتور برای حساب دیگری است");
        assertTransition(from, ["BANK_RATE_LOCKED", "RIAL_RECEIVED"], "درخواست لغو");
        if (!reason) throw badRequest("دلیل درخواست لغو الزامی است");
        if (invoice.cancelRequestedAt) throw conflict("برای این فاکتور قبلاً درخواست لغو ثبت شده است");

        to = from;
        actor = user.role === "ADMIN" ? "ADMIN" : invoice.ownerId === user.id ? "USER" : "COUNTERPARTY";
        data = {
          cancelRequestedAt: new Date(),
          cancelRequestedBy: { connect: { id: user.id } },
          cancelReason: reason,
        };
        recipientNote = {
          kind: "INVOICE_CANCEL_REQUESTED",
          title: "درخواست لغو فاکتور",
          body: `برای فاکتور ${invoice.ref} درخواست لغو ثبت شد: ${reason}`,
          to: "both",
        };
        break;
      }

      /**
       * Calling it off.
       *
       * Where the rial has not arrived yet there is nothing to unwind and the
       * file closes here. Where it has, it closes at CANCELLING instead — the
       * one state that says the system owes somebody money — and only the bank
       * recording the return can finish it. Skipping that would shut the file
       * with the importer's rial still at the bank and no record of it.
       */
      case "cancel": {
        if (invoice.direction !== "IMPORT") throw badRequest("این اقدام فقط برای واردات است");
        if (user.role !== "ADMIN" && user.role !== "BANK") {
          throw forbidden("لغو فاکتور فقط توسط سازمان یا بانک انجام می‌شود");
        }
        assertTransition(from, ["BANK_RATE_LOCKED", "RIAL_RECEIVED"], "لغو فاکتور");
        if (!reason) throw badRequest("دلیل لغو الزامی است");

        const owesRial = from === "RIAL_RECEIVED";
        to = owesRial ? "CANCELLING" : "CANCELLED";
        actor = user.role === "BANK" ? "BANK" : "ADMIN";
        data = {
          cancelReason: reason,
          cancelledAt: new Date(),
          ...(owesRial ? {} : { rialReturnedAt: null }),
        };
        recipientNote = {
          kind: "INVOICE_CANCELLED",
          title: owesRial ? "فاکتور لغو شد — بازگشت ریال در جریان است" : "فاکتور لغو شد",
          body: owesRial
            ? `فاکتور ${invoice.ref} لغو شد: ${reason}. ریال واریزی به حساب واردکننده بازگردانده می‌شود.`
            : `فاکتور ${invoice.ref} لغو شد: ${reason}`,
          to: "both",
        };
        break;
      }

      case "confirmRialReturn": {
        if (user.role !== "BANK") throw forbidden("ثبت بازگشت ریال فقط توسط بانک انجام می‌شود");
        assertTransition(from, ["CANCELLING"], "ثبت بازگشت ریال");
        if (!body.receiptNo) throw badRequest("شماره رسید بازگشت الزامی است");
        to = "CANCELLED";
        actor = "BANK";
        data = { rialReturnReceiptNo: body.receiptNo, rialReturnedAt: new Date() };
        recipientNote = {
          kind: "INVOICE_RIAL_RETURNED",
          title: "ریال بازگردانده شد",
          body: `ریال فاکتور ${invoice.ref} به حساب واردکننده بازگردانده شد`,
          to: "both",
        };
        break;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.invoice.update({
        where: { id: invoice.id },
        data: { ...data, status: to },
        include: INVOICE_INCLUDE,
      });
      await recordTransition(tx, {
        subject: "invoice",
        subjectId: invoice.id,
        fromStatus: from,
        toStatus: to,
        actor,
        actorUserId: user.id,
        note: reason ?? null,
      });
      return next;
    });

    if (recipientNote) {
      const { to: audience = "raiser", ...note } = recipientNote;
      const parties: { id: string | null; role: Role; isRaiser: boolean }[] = [
        { id: invoice.ownerId, role: updated.owner.role, isRaiser: true },
        { id: invoice.counterpartyId, role: updated.counterparty?.role ?? "FOREIGN", isRaiser: false },
      ];
      for (const party of parties) {
        if (!party.id) continue;
        if (audience !== "both" && party.isRaiser !== (audience === "raiser")) continue;
        await notify(party.id, {
          ...note,
          // Each side reads the same invoice at a different route; sending them
          // to the other party's panel just lands them on a guard.
          href: invoiceHref(party.role, invoice.direction, invoice.ref, { isRaiser: party.isRaiser }),
        });
      }
    }

    // A paid invoice is only half the journey: the money is at the gateway, not
    // with the merchant. The books record it, then the payout carries it on.
    // An import's payout is the contract's own transfer to the seller, so
    // there is no rial settlement to raise afterwards.
    if (to === "PAID") {
      await postInvoicePaid({
        id: updated.id,
        ref: updated.ref,
        ownerId: updated.ownerId,
        currency: updated.currency,
        direction: updated.direction,
        receivedAmount: updated.receivedAmount ?? updated.amount,
        feeAmount: updated.feeAmount ?? 0,
        netAmount: updated.netAmount ?? updated.amount,
        share,
      });
      if (updated.direction === "EXPORT") await raisePayoutSettlement(updated);
    }

    return jsonOk({ invoice: serializeInvoice(updated) });
  },
);
