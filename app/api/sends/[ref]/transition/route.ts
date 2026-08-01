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
import { serializeSend } from "@/lib/server/serialize";
import { assertTransition, recordTransition } from "@/lib/server/statusEvents";
import { notify, notifyRole } from "@/lib/server/notify";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";
import { recordChainTx, verifyTransfer, ChainVerificationError } from "@/lib/server/chain/verify";
import { SEND_INCLUDE } from "../../route";
import type { Actor, Prisma, SendStatus } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum([
    "acceptCounterparty",
    "approveAdmin",
    "rejectAdmin",
    "lockRate",
    "confirmRialDeposit",
    "recordCryptoSent",
    "rejectBank",
  ]),
  walletAddress: z.string().trim().optional(),
  reason: z.string().trim().max(500).optional(),
  rate: z.number().positive().optional(),
  bankAccount: z.string().trim().optional(),
  receiptNo: z.string().trim().optional(),
  txHash: z.string().trim().optional(),
  bankWalletAddress: z.string().trim().optional(),
});

/**
 * Drives the send state machine. Every branch checks two things independently:
 * that the caller holds the role entitled to that step, and that the record is
 * in a status the step is reachable from.
 */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;
    const user = await requireUser();
    const body = await readJson(request, Body);

    const send = await db.sendRequest.findFirst({
      where: { OR: [{ ref }, { trxRef: ref }] },
      include: SEND_INCLUDE,
    });
    if (!send) throw notFound("درخواست ارسال یافت نشد");

    const from = send.status;
    let to: SendStatus;
    let actor: Actor;
    let data: Prisma.SendRequestUpdateInput = {};
    let note: string | null = null;

    switch (body.action) {
      case "acceptCounterparty": {
        const isCounterparty =
          user.role === "FOREIGN" &&
          (send.counterpartyId === user.id || send.counterpartyUid === user.uid);
        if (!isCounterparty) throw forbidden("این درخواست متعلق به شما نیست");
        assertTransition(from, ["AWAITING_COUNTERPARTY"], "تأیید درخواست");
        if (!body.walletAddress || !isAddress(body.walletAddress)) {
          throw badRequest("آدرس کیف پول گیرنده معتبر نیست");
        }
        to = "AWAITING_ADMIN";
        actor = "COUNTERPARTY";
        data = {
          recipientWalletAddress: normalizeAddress(body.walletAddress),
          // Link the account now if the request was raised against a bare uid.
          counterparty: { connect: { id: user.id } },
        };
        note = "طرف خارجی آدرس والت خود را تأیید کرد";
        break;
      }

      case "approveAdmin": {
        if (user.role !== "ADMIN") throw forbidden();
        assertTransition(from, ["AWAITING_ADMIN"], "تأیید ادمین");
        to = "AWAITING_BANK_REVIEW";
        actor = "ADMIN";
        note = "توسط ادمین تأیید شد";
        break;
      }

      case "rejectAdmin": {
        if (user.role !== "ADMIN") throw forbidden();
        assertTransition(from, ["AWAITING_COUNTERPARTY", "AWAITING_ADMIN"], "رد درخواست");
        if (!body.reason) throw badRequest("دلیل رد الزامی است");
        to = "REJECTED";
        actor = "ADMIN";
        data = { rejectedBy: "ADMIN", rejectReason: body.reason };
        note = body.reason;
        break;
      }

      case "lockRate": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(from, ["AWAITING_BANK_REVIEW"], "قفل نرخ");
        if (!body.rate) throw badRequest("نرخ ارز الزامی است");
        if (!body.bankAccount) throw badRequest("شماره حساب واریز ریالی الزامی است");
        to = "BANK_RATE_LOCKED";
        actor = "BANK";
        data = {
          exchangeRate: body.rate.toString(),
          rateLocked: true,
          rateLockedAt: new Date(),
          rialAmount: (body.rate * Number(send.amount)).toFixed(2),
          bankAccount: body.bankAccount,
        };
        note = `نرخ ${body.rate} قفل شد`;
        break;
      }

      case "confirmRialDeposit": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(from, ["BANK_RATE_LOCKED"], "تأیید واریز ریال");
        if (!body.receiptNo) throw badRequest("شماره رسید واریز الزامی است");
        to = "RIAL_RECEIVED";
        actor = "BANK";
        data = { rialReceiptNo: body.receiptNo, rialDepositAt: new Date() };
        note = `واریز ریالی با رسید ${body.receiptNo} تأیید شد`;
        break;
      }

      case "recordCryptoSent": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(from, ["RIAL_RECEIVED"], "ثبت ارسال کریپتو");
        if (!body.txHash) throw badRequest("هش تراکنش الزامی است");
        if (!send.recipientWalletAddress) {
          throw badRequest("آدرس کیف پول گیرنده ثبت نشده است");
        }

        // The operator signs outside the system; what makes it real here is
        // that the chain agrees on recipient, currency and amount.
        let verified;
        try {
          verified = await verifyTransfer(body.txHash, {
            to: send.recipientWalletAddress,
            currency: send.currency,
            minAmount: send.amount.toString(),
          });
        } catch (error) {
          if (error instanceof ChainVerificationError) throw badRequest(error.message);
          throw error;
        }
        const chainTx = await recordChainTx(verified, "OUT");

        to = verified.confirmed ? "PAID" : "CRYPTO_SENT";
        actor = "BANK";
        data = {
          chainTx: { connect: { id: chainTx.id } },
          bankWalletAddress: body.bankWalletAddress
            ? normalizeAddress(body.bankWalletAddress)
            : verified.from,
        };
        note = `تراکنش ${verified.hash} با ${verified.confirmations} تأییدیه ثبت شد`;
        break;
      }

      case "rejectBank": {
        if (user.role !== "BANK") throw forbidden();
        assertTransition(
          from,
          ["AWAITING_BANK_REVIEW", "BANK_RATE_LOCKED"],
          "رد درخواست توسط بانک",
        );
        if (!body.reason) throw badRequest("دلیل رد الزامی است");
        to = "REJECTED";
        actor = "BANK";
        data = { rejectedBy: "BANK", rejectReason: body.reason };
        note = body.reason;
        break;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.sendRequest.update({
        where: { id: send.id },
        data: { ...data, status: to },
        include: SEND_INCLUDE,
      });
      await recordTransition(tx, {
        subject: "send",
        subjectId: send.id,
        fromStatus: from,
        toStatus: to,
        actor,
        actorUserId: user.id,
        note,
      });
      return next;
    });

    await announce(updated, to);

    return jsonOk({ send: serializeSend(updated) });
  },
);

/** Tells whichever parties are waiting on this step that it happened. */
async function announce(
  send: Prisma.SendRequestGetPayload<{ include: typeof SEND_INCLUDE }>,
  to: SendStatus,
) {
  switch (to) {
    case "AWAITING_ADMIN":
      await notifyRole("ADMIN", {
        kind: "SEND_AWAITING_ADMIN",
        title: "درخواست ارسال در انتظار تأیید",
        body: `درخواست ${send.ref} آمادهٔ بررسی است`,
        href: "/admin/send",
      });
      break;
    case "AWAITING_BANK_REVIEW":
      await notifyRole("BANK", {
        kind: "SEND_AWAITING_BANK",
        title: "درخواست ارسال جدید",
        body: `درخواست ${send.ref} توسط ادمین تأیید شد`,
        href: "/bank/send",
      });
      break;
    case "BANK_RATE_LOCKED":
      await notify(send.ownerId, {
        kind: "SEND_RATE_LOCKED",
        title: "نرخ ارز اعلام شد",
        body: `نرخ تراکنش ${send.trxRef} قفل شد — منتظر واریز ریال شما`,
        href: "/send",
      });
      break;
    case "CRYPTO_SENT":
    case "PAID":
      await notify(send.ownerId, {
        kind: "SEND_COMPLETED",
        title: to === "PAID" ? "ارسال انجام شد" : "کریپتو ارسال شد",
        body: `تراکنش ${send.trxRef} به مرحله نهایی رسید`,
        href: "/send",
      });
      if (send.counterpartyId) {
        await notify(send.counterpartyId, {
          kind: "FOREIGN_CRYPTO_RECEIVED",
          title: "کریپتو دریافت شد",
          body: `کریپتو تراکنش ${send.trxRef} به والت شما ارسال شد`,
          href: "/foreign/requests",
        });
      }
      break;
    case "REJECTED":
      await notify(send.ownerId, {
        kind: "SEND_REJECTED",
        title: "درخواست ارسال رد شد",
        body: `درخواست ${send.ref} رد شد: ${send.rejectReason ?? ""}`,
        href: "/send",
      });
      break;
    default:
      break;
  }
}
