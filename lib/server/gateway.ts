import "server-only";
import { db } from "./db";
import { ApiError } from "./http";
import {
  currentTerms,
  depositAddressFor,
  GatewayContractError,
  serializeTerms,
} from "./chain/gateway-contract";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Allocates the address an approved invoice is to be paid into.
 *
 * The address comes from the settlement contract, derived from the terms of
 * this invoice alone. Two things follow from that and both matter: whatever
 * arrives there belongs to this invoice and nothing else, and the split between
 * the gateway, the organization and the bank is fixed the moment the buyer is
 * given the address — not decided later by whoever happens to run the payout.
 *
 * Nobody holds a key to it. The money does not rest there; releasing forwards
 * it in three directions in a single transaction.
 */
const SEQUENCE = "afa_deposit_index_seq";

async function nextIndex(client: Prisma.TransactionClient): Promise<number> {
  await client.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${SEQUENCE}" START WITH 1`);
  const rows = await client.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${SEQUENCE}"') AS nextval`,
  );
  return Number(rows[0]!.nextval);
}

export async function allocateDepositAddress(
  invoiceId: string,
  invoiceRef: string,
  client: Prisma.TransactionClient = db,
  /**
   * Import only. The remainder belongs to the foreign seller rather than to the
   * bank's treasury, and pinning the fee to an exact figure is what lets the
   * seller receive the sum on their commercial contract to the last unit —
   * a percentage of the grossed-up total would not divide back cleanly.
   */
  override?: { beneficiary: string; fee: bigint },
): Promise<string> {
  // Re-approving must not move an address a buyer may already be holding.
  const existing = await client.depositAddress.findUnique({ where: { invoiceId } });
  if (existing) return existing.address;

  let address: string;
  let terms;
  try {
    terms = await currentTerms(invoiceRef);
    if (override) {
      terms = {
        ...terms,
        beneficiary: override.beneficiary as `0x${string}`,
        feeBps: 0,
        feeMin: override.fee,
        feeMax: override.fee,
      };
    }
    address = await depositAddressFor(terms);
  } catch (error) {
    console.error("[gateway] could not derive a deposit address", error);
    throw new ApiError(
      503,
      "gateway_contract_unavailable",
      error instanceof GatewayContractError
        ? "قرارداد تسویه پیکربندی نشده است — با پشتیبانی تماس بگیرید"
        : "آدرس پرداخت ساخته نشد — اتصال به شبکه برقرار نیست",
    );
  }

  const index = await nextIndex(client);
  await client.depositAddress.create({
    data: { index, address, invoiceId, terms: serializeTerms(terms) },
  });
  return address;
}

/** Every address the watcher must still scan: allocated and not yet released. */
export async function openDepositAddresses(): Promise<string[]> {
  const rows = await db.depositAddress.findMany({
    where: { sweptAt: null },
    select: { address: true },
  });
  return rows.map((r) => r.address);
}
