import { db } from "@/lib/server/db";
import { forbidden, handler, jsonOk, notFound, requireUser } from "@/lib/server/http";
import { serializeInvoice } from "@/lib/server/serialize";
import { history } from "@/lib/server/statusEvents";
import { env } from "@/lib/server/env";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  counterparty: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

/**
 * Readable by the merchant who raised it, the buyer it was addressed to, and
 * staff. Anyone else holding the reference gets nothing: the buyer has an
 * account here now, so there is no longer a case for showing an invoice to
 * whoever happens to have the link.
 */
export const GET = handler(
  async (_request: Request, ctx: { params: Promise<{ ref: string }> }) => {
    const { ref } = await ctx.params;

    const invoice = await db.invoice.findFirst({
      where: { OR: [{ ref }, { trxRef: ref }] },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw notFound("فاکتور یافت نشد");

    const user = await requireUser();
    const isOwner = user.id === invoice.ownerId;
    const isBuyer = user.id === invoice.counterpartyId;
    const isStaff = user.role === "ADMIN" || user.role === "BANK";

    if (!isOwner && !isBuyer && !isStaff) {
      throw forbidden("این فاکتور در دسترس نیست");
    }

    const { CHAIN_ID, USDT_CONTRACT_ADDRESS, USDT_DECIMALS, CHAIN_EXPLORER_URL } = env();

    return jsonOk({
      invoice: serializeInvoice(invoice),
      // Everything the buyer's browser needs to build the transfer itself.
      // All of it is public chain configuration, not a secret.
      chain: {
        id: CHAIN_ID,
        // Deliberately no RPC URL: ours carries a provider key, and the buyer's
        // wallet brings its own node anyway.
        explorerUrl: CHAIN_EXPLORER_URL,
        token: { address: USDT_CONTRACT_ADDRESS, decimals: USDT_DECIMALS, symbol: "USDT" },
      },
      // The audit trail is internal; buyers only get the invoice itself.
      history: isOwner || isStaff ? await history("invoice", invoice.id) : undefined,
    });
  },
);
