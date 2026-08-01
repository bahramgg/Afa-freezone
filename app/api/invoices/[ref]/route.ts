import { db } from "@/lib/server/db";
import { forbidden, handler, jsonOk, notFound, requireUser } from "@/lib/server/http";
import { serializeInvoice } from "@/lib/server/serialize";
import { history } from "@/lib/server/statusEvents";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

/**
 * A foreign buyer needs to open the payment page without an account, so this
 * route is readable by anyone holding the reference — but it only ever exposes
 * what the payment screen needs, and only for invoices that are payable.
 */
export const GET = handler(
  async (_request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;

    const invoice = await db.invoice.findFirst({
      where: { OR: [{ ref }, { trxRef: ref }] },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw notFound("فاکتور یافت نشد");

    const user = await requireUser().catch(() => null);
    const isOwner = user?.id === invoice.ownerId;
    const isStaff = user?.role === "ADMIN" || user?.role === "BANK";
    const isPayable = invoice.status === "APPROVED" || invoice.status === "PAYMENT_PENDING";

    if (!isOwner && !isStaff && !isPayable) {
      throw forbidden("این فاکتور در دسترس نیست");
    }

    return jsonOk({
      invoice: serializeInvoice(invoice),
      // The audit trail is internal; buyers only get the invoice itself.
      history: isOwner || isStaff ? await history("invoice", invoice.id) : undefined,
    });
  },
);
