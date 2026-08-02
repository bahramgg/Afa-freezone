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
import { notify } from "@/lib/server/notify";
import { allocateDepositAddress } from "@/lib/server/gateway";
import { parseTerms, splitForAmount } from "@/lib/server/chain/gateway-contract";
import { raisePayoutSettlement } from "@/lib/server/payout";
import { postInvoicePaid } from "@/lib/server/postings";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "@/lib/server/chain/verify";
import type { Actor, InvoiceStatus, Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  counterparty: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

const Body = z.object({
  action: z.enum(["approve", "reject", "startPayment", "confirmPayment", "expire"]),
  reason: z.string().trim().max(500).optional(),
  txHash: z.string().trim().optional(),
});

/**
 * The single write path for invoice status. Each action declares which statuses
 * it may run from, so a stale tab or a replayed request cannot move an invoice
 * backwards or approve one the admin already rejected.
 */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;
    const { action, reason, txHash } = await readJson(request, Body);

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
    let recipientNote: { title: string; body: string; kind: string } | null = null;

    switch (action) {
      case "approve": {
        if (user.role !== "ADMIN") throw forbidden("تأیید فاکتور فقط توسط ادمین انجام می‌شود");
        assertTransition(from, ["PENDING"], "تأیید فاکتور");
        to = "APPROVED";
        actor = "ADMIN";
        // Derived at approval, so an unapproved invoice never advertises
        // somewhere to send money — and derived per invoice, so whatever lands
        // there can only belong to this one.
        data = { paymentAddress: await allocateDepositAddress(invoice.id, invoice.ref) };
        recipientNote = {
          kind: "INVOICE_APPROVED",
          title: "فاکتور تأیید شد",
          body: `فاکتور ${invoice.ref} تأیید شد — لینک پرداخت را برای خریدار بفرستید`,
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
        };
        break;
      }
      case "startPayment": {
        if (invoice.counterpartyId !== user.id) {
          throw forbidden("این فاکتور برای حساب دیگری صادر شده است");
        }
        assertTransition(from, ["APPROVED"], "شروع پرداخت");
        if (invoice.expiresAt && invoice.expiresAt.getTime() < Date.now()) {
          throw badRequest("مهلت پرداخت این فاکتور به پایان رسیده است");
        }
        to = "PAYMENT_PENDING";
        actor = "COUNTERPARTY";
        break;
      }
      case "confirmPayment": {
        // The buyer reports the hash of the payment they made. The deposit
        // watcher does this automatically when log scanning is available; this
        // path lets a payment settle without it, and is no less safe because
        // the chain — not the caller — supplies amount and recipient.
        if (invoice.counterpartyId !== user.id) {
          throw forbidden("این فاکتور برای حساب دیگری صادر شده است");
        }
        assertTransition(from, ["APPROVED", "PAYMENT_PENDING"], "ثبت پرداخت");
        if (!txHash) throw badRequest("هش تراکنش الزامی است");
        if (!invoice.paymentAddress) throw badRequest("آدرس پرداخت این فاکتور تعیین نشده است");

        let verified;
        try {
          verified = await verifyTransfer(txHash, {
            to: invoice.paymentAddress,
            currency: invoice.currency,
            minAmount: invoice.amount.toString(),
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
        const { fee, net } = splitForAmount(parseTerms(deposit.terms), verified.amount);

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
      await notify(invoice.ownerId, { ...recipientNote, href: `/receive/${invoice.ref}` });
    }

    // A paid invoice is only half the journey: the money is at the gateway, not
    // with the merchant. The books record it, then the payout carries it on.
    if (to === "PAID") {
      await postInvoicePaid({
        id: updated.id,
        ref: updated.ref,
        ownerId: updated.ownerId,
        currency: updated.currency,
        receivedAmount: updated.receivedAmount ?? updated.amount,
        feeAmount: updated.feeAmount ?? 0,
        netAmount: updated.netAmount ?? updated.amount,
      });
      await raisePayoutSettlement(updated);
    }

    return jsonOk({ invoice: serializeInvoice(updated) });
  },
);
