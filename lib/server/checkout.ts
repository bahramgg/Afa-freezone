import "server-only";
import { db } from "./db";
import { env } from "./env";
import { currentUser } from "./auth/session";
import { serializeInvoice } from "./serialize";

/**
 * What the payment page shows.
 *
 * The buyer now holds an account — an export brings currency into the country,
 * so who paid has to be known — and this returns nothing to anyone else. The
 * page itself still lives on a shareable link; opening it without being the
 * addressed buyer asks for a sign-in rather than showing the invoice.
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

export type CheckoutAccess =
  | { state: "ok"; data: CheckoutData }
  /** No session, or one belonging to someone else. */
  | { state: "sign-in" }
  | { state: "not-found" };

export async function checkoutView(reference: string): Promise<CheckoutAccess> {
  const invoice = await db.invoice.findFirst({
    where: { OR: [{ ref: reference }, { trxRef: reference }] },
    include: {
      owner: { select: { uid: true, fullName: true } },
      counterparty: { select: { uid: true, fullName: true } },
      chainTx: true,
    },
  });
  if (!invoice) return { state: "not-found" };

  const user = await currentUser();
  const maySee =
    user &&
    (user.id === invoice.counterpartyId ||
      user.id === invoice.ownerId ||
      user.role === "ADMIN" ||
      user.role === "BANK");
  if (!maySee) return { state: "sign-in" };

  return {
    state: "ok",
    data: { invoice: serializeInvoice(invoice), chain: publicChainInfo() },
  };
}
