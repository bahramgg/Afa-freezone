import "server-only";
import { db } from "./db";
import { badRequest, forbidden } from "./http";
import { assertTransition } from "./statusEvents";
import { notify } from "./notify";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "./chain/verify";
import { alreadyPosted, post, splitGatewayFee, unitFor } from "./ledger";
import { Prisma } from "@/lib/generated/prisma/client";
import type { SessionUser } from "./auth/session";

const REFUND_INCLUDE = {
  invoice: {
    select: { ref: true, ownerId: true, owner: { select: { uid: true, fullName: true } } },
  },
  requestedBy: { select: { uid: true, fullName: true } },
} satisfies Prisma.RefundInclude;

type Refund = Prisma.RefundGetPayload<{ include: typeof REFUND_INCLUDE }>;

/**
 * Drives a refund from request to proof.
 *
 * Admin decides whether the money goes back; the bank moves it and hands over
 * the hash. The chain has the last word on whether it actually went where it
 * was supposed to, exactly as it does for every other transfer here.
 */
export async function applyRefundTransition(
  refund: Refund,
  body: { action: "approve" | "reject" | "markSent"; reason?: string; txHash?: string },
  user: SessionUser,
): Promise<Refund> {
  let data: Prisma.RefundUpdateInput = {};
  let note: string;

  switch (body.action) {
    case "approve": {
      if (user.role !== "ADMIN") throw forbidden("تأیید بازگشت وجه فقط توسط ادمین انجام می‌شود");
      assertTransition(refund.status, ["REQUESTED"], "تأیید بازگشت وجه");
      data = { status: "APPROVED" };
      note = "بازگشت وجه توسط ادمین تأیید شد";
      break;
    }

    case "reject": {
      if (user.role !== "ADMIN") throw forbidden("رد بازگشت وجه فقط توسط ادمین انجام می‌شود");
      assertTransition(refund.status, ["REQUESTED", "APPROVED"], "رد بازگشت وجه");
      if (!body.reason) throw badRequest("دلیل رد الزامی است");
      data = { status: "REJECTED", rejectReason: body.reason };
      note = `بازگشت وجه رد شد: ${body.reason}`;
      break;
    }

    case "markSent": {
      if (user.role !== "BANK") throw forbidden("ثبت انتقال فقط توسط بانک انجام می‌شود");
      assertTransition(refund.status, ["APPROVED"], "ثبت انتقال بازگشت وجه");
      if (!body.txHash) throw badRequest("هش تراکنش الزامی است");

      // The operator signs outside the system; what settles it here is that the
      // chain agrees the money went to the address the buyer paid from.
      let verified;
      try {
        verified = await verifyTransfer(body.txHash, {
          to: refund.toAddress,
          currency: refund.currency,
          minAmount: refund.amount.toString(),
        });
      } catch (error) {
        if (error instanceof ChainVerificationError) throw badRequest(error.message);
        throw error;
      }
      await recordChainTx(verified, "OUT");

      data = { status: "SENT", txHash: verified.hash, sentAt: new Date() };
      note = `بازگشت وجه با تراکنش ${verified.hash} انجام شد`;
      break;
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.refund.update({
      where: { id: refund.id },
      data,
      include: REFUND_INCLUDE,
    });
    await tx.statusEvent.create({
      data: {
        subject: "invoice",
        subjectId: refund.invoiceId,
        fromStatus: refund.status,
        toStatus: next.status,
        actor: user.role === "ADMIN" ? "ADMIN" : "BANK",
        actorUserId: user.id,
        note,
      },
    });
    return next;
  });

  if (updated.status === "SENT") await postRefundSent(updated);

  await notify(refund.invoice.ownerId, {
    kind: "REFUND_UPDATED",
    title: "وضعیت بازگشت وجه",
    body: `${refund.ref} — ${note}`,
    href: "/receive",
  });

  return updated;
}

/**
 * Unwinds the books for money that went back.
 *
 * Everything the payment created is reversed, the fee shares included: the
 * gateway did not end up carrying a payment through, so it does not keep a fee
 * for having done so. Reversing the shares rather than netting them off keeps
 * both movements visible in the ledger.
 */
async function postRefundSent(refund: Refund): Promise<void> {
  if (await alreadyPosted("REFUND_SENT", refund.id)) return;

  const invoice = await db.invoice.findUnique({
    where: { id: refund.invoiceId },
    select: { feeAmount: true, netAmount: true, ownerId: true, ref: true },
  });
  if (!invoice) return;

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const { gateway, freezone } = splitGatewayFee(
    invoice.feeAmount ?? 0,
    new Prisma.Decimal(settings?.freezoneSharePercent ?? 50),
  );
  const unit = unitFor(refund.currency);
  const negate = (v: Prisma.Decimal | string | number) => new Prisma.Decimal(v).negated();

  await post(
    { kind: "REFUND_SENT", subject: "invoice", subjectId: refund.id, subjectRef: refund.ref },
    [
      { account: "REFUNDED", amount: refund.amount, unit, note: `بازگشت وجه فاکتور ${invoice.ref}` },
      { account: "DEPOSIT_HELD", amount: negate(refund.amount), unit },
      {
        account: "MERCHANT_PAYABLE",
        amount: negate(invoice.netAmount ?? 0),
        unit,
        userId: invoice.ownerId,
        note: "بدهی با بازگشت وجه منتفی شد",
      },
      { account: "GATEWAY_SHARE", amount: negate(gateway), unit, note: "کارمزد برگشت خورد" },
      { account: "FREEZONE_SHARE", amount: negate(freezone), unit, note: "کارمزد برگشت خورد" },
    ],
  );
}
