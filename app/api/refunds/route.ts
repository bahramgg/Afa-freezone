import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  conflict,
  handler,
  jsonOk,
  notFound,
  readJson,
  requireRole,
  requireUser,
} from "@/lib/server/http";
import { nextRef } from "@/lib/server/refs";
import { notify, notifyRole } from "@/lib/server/notify";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFUND_INCLUDE = {
  invoice: { select: { ref: true, ownerId: true, owner: { select: { uid: true, fullName: true } } } },
  requestedBy: { select: { uid: true, fullName: true } },
} satisfies Prisma.RefundInclude;

function serialize(r: Prisma.RefundGetPayload<{ include: typeof REFUND_INCLUDE }>) {
  return {
    id: r.ref,
    dbId: r.id,
    invoiceRef: r.invoice.ref,
    merchantUid: r.invoice.owner?.uid,
    merchantName: r.invoice.owner?.fullName,
    amount: Number(r.amount),
    currency: r.currency,
    toAddress: r.toAddress,
    status: r.status,
    reason: r.reason,
    rejectReason: r.rejectReason ?? undefined,
    txHash: r.txHash ?? undefined,
    requestedBy: r.requestedBy?.fullName,
    sentAt: r.sentAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Refunds a merchant or admin has raised.
 *
 * A merchant sees their own; staff see all of them, because the money leaves
 * the gateway's custody and both the bank and the admin have to answer for it.
 */
export const GET = handler(async () => {
  const user = await requireUser();

  const where: Prisma.RefundWhereInput =
    user.role === "ADMIN" || user.role === "BANK"
      ? {}
      : { invoice: { ownerId: user.id } };

  const list = await db.refund.findMany({
    where,
    include: REFUND_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return jsonOk({ list: list.map(serialize) });
});

const CreateBody = z.object({
  invoiceRef: z.string().trim().min(1),
  reason: z.string().trim().min(3, "دلیل بازگشت وجه الزامی است").max(500),
});

/**
 * Raises a refund against a paid invoice.
 *
 * The destination is not a parameter. It is read off the transfer that funded
 * the invoice, so the money can only go back where it came from — a refund is
 * the one operation where a mistyped address would be both irreversible and
 * unnoticed until the buyer complained.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { invoiceRef, reason } = await readJson(request, CreateBody);

  const invoice = await db.invoice.findFirst({
    where: { OR: [{ ref: invoiceRef }, { trxRef: invoiceRef }] },
    include: { chainTx: true, refunds: true, settlement: true },
  });
  if (!invoice) throw notFound("فاکتور یافت نشد");

  const isOwner = invoice.ownerId === user.id;
  if (!isOwner && user.role !== "ADMIN") throw badRequest("این فاکتور متعلق به شما نیست");

  if (invoice.status !== "PAID") throw badRequest("فقط فاکتور پرداخت‌شده قابل بازگشت است");
  if (invoice.refunds.some((r) => r.status !== "REJECTED")) {
    throw conflict("برای این فاکتور قبلاً درخواست بازگشت ثبت شده است");
  }
  if (invoice.settlement && invoice.settlement.status === "SETTLED") {
    throw conflict("ریال این فاکتور به تاجر پرداخت شده — بازگشت وجه ممکن نیست");
  }
  if (!invoice.chainTx) {
    throw badRequest("تراکنش پرداخت این فاکتور ثبت نشده — مقصد بازگشت مشخص نیست");
  }

  const amount = invoice.receivedAmount ?? invoice.amount;
  const { ref } = await nextRef("settlement");

  const refund = await db.$transaction(async (tx) => {
    const row = await tx.refund.create({
      data: {
        ref: `RFD-${ref.split("-")[1]}`,
        invoiceId: invoice.id,
        amount,
        currency: invoice.currency,
        // Straight off the chain: whoever paid is who gets it back.
        toAddress: invoice.chainTx!.fromAddress,
        reason,
        requestedById: user.id,
      },
      include: REFUND_INCLUDE,
    });
    await tx.statusEvent.create({
      data: {
        subject: "invoice",
        subjectId: invoice.id,
        fromStatus: invoice.status,
        toStatus: invoice.status,
        actor: user.role === "ADMIN" ? "ADMIN" : "USER",
        actorUserId: user.id,
        note: `درخواست بازگشت وجه ${row.ref}: ${reason}`,
      },
    });
    return row;
  });

  await notifyRole("ADMIN", {
    kind: "REFUND_REQUESTED",
    title: "درخواست بازگشت وجه",
    body: `برای فاکتور ${invoice.ref} درخواست بازگشت ${amount} ${invoice.currency} ثبت شد`,
    href: "/admin/refunds",
  });
  if (!isOwner) {
    await notify(invoice.ownerId, {
      kind: "REFUND_REQUESTED",
      title: "درخواست بازگشت وجه",
      body: `برای فاکتور ${invoice.ref} درخواست بازگشت وجه ثبت شد`,
      href: "/receive",
    });
  }

  return jsonOk({ refund: serialize(refund) }, { status: 201 });
});

const TransitionBody = z.object({
  ref: z.string().trim().min(1),
  action: z.enum(["approve", "reject", "markSent"]),
  reason: z.string().trim().max(500).optional(),
  txHash: z.string().trim().optional(),
});

/** Moves a refund along: admin clears it, the bank executes and proves it. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireRole("ADMIN", "BANK");
  const body = await readJson(request, TransitionBody);

  const refund = await db.refund.findUnique({
    where: { ref: body.ref },
    include: REFUND_INCLUDE,
  });
  if (!refund) throw notFound("درخواست بازگشت یافت نشد");

  const { applyRefundTransition } = await import("@/lib/server/refunds");
  const updated = await applyRefundTransition(refund, body, user);

  return jsonOk({ refund: serialize(updated) });
});
