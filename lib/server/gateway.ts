import "server-only";
import { db } from "./db";
import { ApiError } from "./http";

/**
 * Picks the bank receive wallet an approved invoice should be paid into.
 *
 * Deposits are matched by (address, amount), so spreading invoices across the
 * available receive wallets reduces the chance of two open invoices for the
 * same amount sitting on one address. The wallet with the fewest open invoices
 * wins.
 */
export async function pickGatewayAddress(): Promise<string> {
  const wallets = await db.wallet.findMany({
    where: { ownerKind: "BANK", active: true, bankKind: { in: ["RECEIVE", "SHARED"] } },
    select: { address: true },
    orderBy: { createdAt: "asc" },
  });

  if (wallets.length === 0) {
    throw new ApiError(
      503,
      "no_gateway_wallet",
      "هیچ کیف پول دریافت فعالی تعریف نشده است — با پشتیبانی تماس بگیرید",
    );
  }

  const open = await db.invoice.groupBy({
    by: ["paymentAddress"],
    where: {
      status: { in: ["APPROVED", "PAYMENT_PENDING"] },
      paymentAddress: { in: wallets.map((w) => w.address) },
    },
    _count: { _all: true },
  });

  const load = new Map(open.map((o) => [o.paymentAddress ?? "", o._count._all]));
  return wallets.reduce((best, w) =>
    (load.get(w.address) ?? 0) < (load.get(best.address) ?? 0) ? w : best,
  ).address;
}
