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
import { currentUser } from "@/lib/server/auth/session";
import { serializeInvoice } from "@/lib/server/serialize";
import { assertTransition, recordTransition } from "@/lib/server/statusEvents";
import { notify } from "@/lib/server/notify";
import { pickGatewayAddress } from "@/lib/server/gateway";
import type { Actor, InvoiceStatus, Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

const Body = z.object({
  action: z.enum(["approve", "reject", "startPayment", "expire"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * The single write path for invoice status. Each action declares which statuses
 * it may run from, so a stale tab or a replayed request cannot move an invoice
 * backwards or approve one the admin already rejected.
 */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;
    const { action, reason } = await readJson(request, Body);

    // `startPayment` is what a buyer holding the invoice link triggers when the
    // payment screen opens. It carries no financial effect and reveals nothing
    // the public invoice lookup doesn't already show, so it needs no session.
    // Every other action is staff-only and resolves a user first.
    const user = action === "startPayment" ? await currentUser() : await requireUser();

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
        if (user?.role !== "ADMIN") throw forbidden("تأیید فاکتور فقط توسط ادمین انجام می‌شود");
        assertTransition(from, ["PENDING"], "تأیید فاکتور");
        to = "APPROVED";
        actor = "ADMIN";
        // The address is assigned at approval, so an unapproved invoice never
        // advertises somewhere to send money.
        data = { paymentAddress: await pickGatewayAddress() };
        recipientNote = {
          kind: "INVOICE_APPROVED",
          title: "فاکتور تأیید شد",
          body: `فاکتور ${invoice.ref} توسط ادمین تأیید شد`,
        };
        break;
      }
      case "reject": {
        if (user?.role !== "ADMIN") throw forbidden("رد فاکتور فقط توسط ادمین انجام می‌شود");
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
        // The buyer opening the payment screen moves the invoice along; anyone
        // holding the reference may do this, but only from APPROVED.
        assertTransition(from, ["APPROVED"], "شروع پرداخت");
        if (invoice.expiresAt && invoice.expiresAt.getTime() < Date.now()) {
          throw badRequest("مهلت پرداخت این فاکتور به پایان رسیده است");
        }
        to = "PAYMENT_PENDING";
        actor = "COUNTERPARTY";
        break;
      }
      case "expire": {
        if (user?.role !== "ADMIN") throw forbidden();
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
        actorUserId: user?.id ?? null,
        note: reason ?? null,
      });
      return next;
    });

    if (recipientNote) {
      await notify(invoice.ownerId, { ...recipientNote, href: `/receive/${invoice.ref}` });
    }

    return jsonOk({ invoice: serializeInvoice(updated) });
  },
);
