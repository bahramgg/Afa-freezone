import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  forbidden,
  handler,
  jsonOk,
  notFound,
  readJson,
  requireUser,
} from "@/lib/server/http";
import { serializeSettlement } from "@/lib/server/serialize";
import { assertTransition, recordTransition } from "@/lib/server/statusEvents";
import { notify, notifyRole } from "@/lib/server/notify";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "@/lib/server/chain/verify";
import { toRial } from "@/lib/server/money";
import { assertRateWithinTolerance, referenceRate } from "@/lib/server/rates";
import { bankSpread } from "@/lib/server/ledger";
import { postSettlementFunded, postSettlementSettled } from "@/lib/server/postings";
import { SETTLEMENT_INCLUDE } from "../../route";
import type { Actor, Prisma, SettlementStatus } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum([
    "setPayoutAccount",
    "approveAdmin",
    "rejectAdmin",
    "lockRate",
    "submitPayoutTx",
    "settle",
    "rejectBank",
  ]),
  payoutAccount: z.string().trim().max(40).optional(),
  reason: z.string().trim().max(500).optional(),
  rate: z.number().positive().optional(),
  bankWalletAddress: z.string().trim().optional(),
  txHash: z.string().trim().optional(),
  receiptNo: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;
    const user = await requireUser();
    const body = await readJson(request, Body);

    const settlement = await db.settlement.findFirst({
      where: { OR: [{ ref }, { trxRef: ref }] },
      include: SETTLEMENT_INCLUDE,
    });
    if (!settlement) throw notFound("درخواست تسویه یافت نشد");

    const from = settlement.status;
    let to: SettlementStatus;
    let actor: Actor;
    let data: Prisma.SettlementUpdateInput = {};
    let note: string | null = null;
    // Set where the event moves value, so the books are written after the
    // status commits rather than in the middle of the switch.
    let funded = false;

    switch (body.action) {
      case "setPayoutAccount": {
        // A settlement raised from a paid invoice knows the amount but not
        // where the rial should go — only the merchant can say that.
        if (user.id !== settlement.ownerId) throw forbidden("این درخواست متعلق به شما نیست");
        assertTransition(from, ["AWAITING_ADMIN", "AWAITING_BANK"], "ثبت شماره حساب");
        if (!body.payoutAccount || body.payoutAccount.length < 4) {
          throw badRequest("شماره حساب مقصد الزامی است");
        }
        to = from;
        actor = "USER";
        data = { payoutAccount: body.payoutAccount };
        note = "شماره حساب دریافت ریال ثبت شد";
        break;
      }

      case "approveAdmin": {
        if (user.role !== "ADMIN") throw forbidden();
        assertTransition(from, ["AWAITING_ADMIN"], "تأیید تسویه");
        to = "AWAITING_BANK";
        actor = "ADMIN";
        note = "توسط ادمین تأیید شد";
        break;
      }

      case "rejectAdmin": {
        if (user.role !== "ADMIN") throw forbidden();
        assertTransition(from, ["AWAITING_ADMIN"], "رد تسویه");
        if (!body.reason) throw badRequest("دلیل رد الزامی است");
        to = "REJECTED";
        actor = "ADMIN";
        data = { rejectedBy: "ADMIN", rejectReason: body.reason, bankResponseAt: new Date() };
        note = body.reason;
        break;
      }

      case "lockRate": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(from, ["AWAITING_BANK"], "قفل نرخ");
        if (!body.rate) throw badRequest("نرخ ارز الزامی است");
        if (!settlement.payoutAccount) {
          throw badRequest("تاجر هنوز شماره حساب دریافت ریال را وارد نکرده است");
        }
        // The bank's own wallet only matters when the merchant still has to
        // send the crypto; on an invoice payout the bank already holds it.
        if (!settlement.sourceInvoiceId && (!body.bankWalletAddress || !isAddress(body.bankWalletAddress))) {
          throw badRequest("آدرس کیف پول بانک معتبر نیست");
        }
        await assertRateWithinTolerance(body.rate, settlement.currency);
        // Buying currency from an exporter, the bank earns by locking a rate
        // below the reference. Recorded here because it exists nowhere else.
        const spread = bankSpread({
          side: "buy",
          lockedRate: body.rate,
          referenceRate: await referenceRate(settlement.currency),
          tokenAmount: settlement.netAmount ?? settlement.amount,
        });

        to = "BANK_RATE_LOCKED";
        actor = "BANK";
        data = {
          exchangeRate: body.rate.toString(),
          rateLocked: true,
          rateLockedAt: new Date(),
          bankSpreadRial: spread,
          // The rial follows the merchant's side of the ledger, which already
          // has the gateway fee taken off it.
          rialAmount: toRial(body.rate, settlement.netAmount ?? settlement.amount),
          bankWalletAddress: body.bankWalletAddress
            ? normalizeAddress(body.bankWalletAddress)
            : undefined,
        };
        note = settlement.sourceInvoiceId
          ? `نرخ ${body.rate} قفل شد`
          : `نرخ ${body.rate} قفل شد و آدرس کیف پول بانک اعلام شد`;
        break;
      }

      case "submitPayoutTx": {
        // The merchant reports the transfer they made to the bank's wallet.
        if (user.id !== settlement.ownerId) throw forbidden("این درخواست متعلق به شما نیست");
        assertTransition(from, ["BANK_RATE_LOCKED"], "ثبت تراکنش پرداخت");
        if (settlement.sourceInvoiceId) {
          throw badRequest("این تسویه از یک فاکتور پرداخت‌شده ساخته شده — کریپتو از قبل نزد بانک است");
        }
        if (!body.txHash) throw badRequest("هش تراکنش الزامی است");
        if (!settlement.bankWalletAddress) {
          throw badRequest("آدرس کیف پول بانک هنوز اعلام نشده است");
        }

        let verified;
        try {
          verified = await verifyTransfer(body.txHash, {
            to: settlement.bankWalletAddress,
            currency: settlement.currency,
            minAmount: settlement.amount.toString(),
          });
        } catch (error) {
          if (error instanceof ChainVerificationError) throw badRequest(error.message);
          throw error;
        }
        const chainTx = await recordChainTx(verified, "IN");

        // Only a finalised transfer skips straight to CRYPTO_CONFIRMED; the
        // watcher promotes the rest once they mature.
        to = verified.confirmed ? "CRYPTO_CONFIRMED" : "CRYPTO_RECEIVED";
        actor = "USER";
        data = { chainTx: { connect: { id: chainTx.id } } };
        funded = true;
        note = `تراکنش ${verified.hash} با ${verified.confirmations} تأییدیه ثبت شد`;
        break;
      }

      case "settle": {
        if (user.role !== "BANK") throw forbidden();
        // An invoice payout skips the crypto leg entirely: the transfer that
        // funded it was already verified on the invoice.
        assertTransition(
          from,
          settlement.sourceInvoiceId
            ? ["BANK_RATE_LOCKED", "CRYPTO_CONFIRMED"]
            : ["CRYPTO_CONFIRMED"],
          "تسویه نهایی",
        );
        if (!body.receiptNo) throw badRequest("شماره رسید واریز ریالی الزامی است");
        to = "SETTLED";
        actor = "BANK";
        data = {
          rialReceiptNo: body.receiptNo,
          rialDepositAt: new Date(),
          settledAt: new Date(),
          bankResponseAt: settlement.bankResponseAt ?? new Date(),
          bankResponseNote: body.note ?? "ریال به حساب کاربر واریز شد",
        };
        note = `واریز ریالی با رسید ${body.receiptNo}`;
        break;
      }

      case "rejectBank": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(
          from,
          ["AWAITING_BANK", "BANK_RATE_LOCKED", "CRYPTO_CONFIRMED"],
          "رد تسویه توسط بانک",
        );
        if (!body.reason) throw badRequest("دلیل رد الزامی است");
        to = "REJECTED";
        actor = "BANK";
        data = {
          rejectedBy: "BANK",
          rejectReason: body.reason,
          bankResponseAt: new Date(),
          bankResponseNote: body.reason,
        };
        note = body.reason;
        break;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.settlement.update({
        where: { id: settlement.id },
        data: { ...data, status: to },
        include: SETTLEMENT_INCLUDE,
      });
      await recordTransition(tx, {
        subject: "settlement",
        subjectId: settlement.id,
        fromStatus: from,
        toStatus: to,
        actor,
        actorUserId: user.id,
        note,
      });
      return next;
    });

    if (funded) {
      await postSettlementFunded({
        id: updated.id,
        ref: updated.ref,
        ownerId: updated.ownerId,
        currency: updated.currency,
        amount: updated.amount,
        feeAmount: updated.feeAmount ?? 0,
        netAmount: updated.netAmount ?? updated.amount,
      });
    }
    if (to === "SETTLED") {
      await postSettlementSettled({
        id: updated.id,
        ref: updated.ref,
        ownerId: updated.ownerId,
        currency: updated.currency,
        netAmount: updated.netAmount ?? updated.amount,
        spreadRial: updated.bankSpreadRial,
      });
    }

    await announce(updated, to);

    return jsonOk({ settlement: serializeSettlement(updated) });
  },
);

async function announce(
  settlement: Prisma.SettlementGetPayload<{ include: typeof SETTLEMENT_INCLUDE }>,
  to: SettlementStatus,
) {
  switch (to) {
    case "AWAITING_BANK":
      await notifyRole("BANK", {
        kind: "SETTLEMENT_AWAITING_BANK",
        title: "درخواست تسویه جدید",
        body: `درخواست ${settlement.ref} توسط ادمین تأیید شد`,
        href: "/bank/settlement",
      });
      break;
    case "BANK_RATE_LOCKED":
      await notify(settlement.ownerId, {
        kind: "SETTLEMENT_APPROVED",
        title: "آدرس والت بانک اعلام شد",
        body: `برای ${settlement.trxRef} نرخ قفل شد — کریپتو را به آدرس اعلام‌شده ارسال کنید`,
        href: "/settlement",
      });
      break;
    case "CRYPTO_RECEIVED":
    case "CRYPTO_CONFIRMED":
      await notifyRole("BANK", {
        kind: "SETTLEMENT_CRYPTO_RECEIVED",
        title: "کریپتو دریافت شد",
        body: `تراکنش تسویه ${settlement.ref} روی زنجیره ثبت شد`,
        href: "/bank/settlement",
      });
      break;
    case "SETTLED":
      await notify(settlement.ownerId, {
        kind: "SETTLEMENT_SETTLED",
        title: "تسویه انجام شد",
        body: `مبلغ درخواست ${settlement.ref} به حساب شما واریز شد`,
        href: "/settlement",
      });
      break;
    case "REJECTED":
      await notify(settlement.ownerId, {
        kind: "SETTLEMENT_REJECTED",
        title: "درخواست تسویه رد شد",
        body: `درخواست ${settlement.ref} رد شد: ${settlement.rejectReason ?? ""}`,
        href: "/settlement",
      });
      break;
    default:
      break;
  }
}
