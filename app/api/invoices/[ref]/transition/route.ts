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
import { currentUser } from "@/lib/server/auth/session";
import { serializeInvoice } from "@/lib/server/serialize";
import { assertTransition, recordTransition } from "@/lib/server/statusEvents";
import { notify } from "@/lib/server/notify";
import { allocateDepositAddress } from "@/lib/server/gateway";
import { feeFor } from "@/lib/server/fees";
import { raisePayoutSettlement } from "@/lib/server/payout";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "@/lib/server/chain/verify";
import type { Actor, InvoiceStatus, Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
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

    // `startPayment` is what a buyer holding the invoice link triggers when the
    // payment screen opens. It carries no financial effect and reveals nothing
    // the public invoice lookup doesn't already show, so it needs no session.
    // Every other action is staff-only and resolves a user first.
    const user =
      action === "startPayment" || action === "confirmPayment"
        ? await currentUser()
        : await requireUser();

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
        // Derived at approval, so an unapproved invoice never advertises
        // somewhere to send money — and derived per invoice, so whatever lands
        // there can only belong to this one.
        data = { paymentAddress: await allocateDepositAddress(invoice.id) };
        recipientNote = {
          kind: "INVOICE_APPROVED",
          title: "فاکتور تأیید شد",
          body: `فاکتور ${invoice.ref} تأیید شد — لینک پرداخت را برای خریدار بفرستید`,
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
      case "confirmPayment": {
        // The buyer reports the hash of the payment they made. The deposit
        // watcher does this automatically when log scanning is available; this
        // path lets a payment settle without it, and is no less safe because
        // the chain — not the caller — supplies amount and recipient.
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

        const { fee, net } = await feeFor(Number(invoice.amount));

        to = "PAID";
        actor = "COUNTERPARTY";
        data = {
          chainTx: { connect: { id: chainTx.id } },
          paidAt: new Date(),
          feeAmount: fee.toFixed(8),
          netAmount: net.toFixed(8),
        };
        recipientNote = {
          kind: "PAYMENT_RECEIVED",
          title: "پرداخت دریافت شد",
          body: `پرداخت فاکتور ${invoice.ref} روی شبکه تأیید شد`,
        };
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

    // A paid invoice is only half the journey: the money is at the bank, not
    // with the merchant. Raising the payout is what finishes it.
    if (to === "PAID") await raisePayoutSettlement(updated);

    return jsonOk({ invoice: serializeInvoice(updated) });
  },
);
