import "server-only";
import { db } from "./db";
import { env } from "./env";
import { serializeInvoice } from "./serialize";

/**
 * The public view of a payment request.
 *
 * A buyer has no account, so this is deliberately readable by anyone holding
 * the reference — but only while the invoice is actually payable, and it never
 * carries the audit trail or anything about the merchant beyond their name.
 */
export type CheckoutData = {
  invoice: ReturnType<typeof serializeInvoice>;
  chain: {
    id: number;
    explorerUrl: string;
    token: { address: string; decimals: number; symbol: string };
  };
};

/** Chain configuration the buyer's wallet needs. All of it is public. */
export function publicChainInfo(): CheckoutData["chain"] {
  const { CHAIN_ID, CHAIN_EXPLORER_URL, USDT_CONTRACT_ADDRESS, USDT_DECIMALS } = env();
  return {
    id: CHAIN_ID,
    // Deliberately no RPC URL: ours carries a provider key, and the buyer's
    // wallet brings its own node anyway.
    explorerUrl: CHAIN_EXPLORER_URL,
    token: { address: USDT_CONTRACT_ADDRESS, decimals: USDT_DECIMALS, symbol: "USDT" },
  };
}

export async function checkoutView(reference: string): Promise<CheckoutData | null> {
  const invoice = await db.invoice.findFirst({
    where: { OR: [{ ref: reference }, { trxRef: reference }] },
    include: { owner: { select: { uid: true, fullName: true } }, chainTx: true },
  });
  if (!invoice) return null;

  // A rejected or unapproved invoice tells an anonymous caller nothing.
  const visible =
    invoice.status === "APPROVED" ||
    invoice.status === "PAYMENT_PENDING" ||
    invoice.status === "PAID" ||
    invoice.status === "EXPIRED";
  if (!visible) return null;

  return { invoice: serializeInvoice(invoice), chain: publicChainInfo() };
}
