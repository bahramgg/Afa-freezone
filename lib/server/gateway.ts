import "server-only";
import { db } from "./db";
import { ApiError } from "./http";
import { deriveDepositAddress } from "./chain/hd";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Allocates the address an approved invoice is to be paid into.
 *
 * Every invoice gets its own, derived at its own index. That is what makes a
 * deposit unambiguous: invoices used to share a handful of bank wallets, so the
 * watcher had to guess which one a payment belonged to from its amount — a 1000
 * USDT payment settled a 500 USDT invoice that happened to be older, and the
 * difference vanished into the bank's wallet.
 *
 * Indexes come from a Postgres sequence, so two concurrent approvals can never
 * be handed the same one.
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
  client: Prisma.TransactionClient = db,
): Promise<string> {
  // Re-approving must not move an address a buyer may already be holding.
  const existing = await client.depositAddress.findUnique({ where: { invoiceId } });
  if (existing) return existing.address;

  let index: number;
  let address: string;
  try {
    index = await nextIndex(client);
    address = deriveDepositAddress(index);
  } catch (error) {
    console.error("[gateway] could not derive a deposit address", error);
    throw new ApiError(
      503,
      "no_gateway_xpub",
      "آدرس پرداخت ساخته نشد — پیکربندی درگاه ناقص است، با پشتیبانی تماس بگیرید",
    );
  }

  await client.depositAddress.create({ data: { index, address, invoiceId } });
  return address;
}

/** Every address the watcher must still scan: allocated and not yet swept. */
export async function openDepositAddresses(): Promise<string[]> {
  const rows = await db.depositAddress.findMany({
    where: { sweptAt: null },
    select: { address: true },
  });
  return rows.map((r) => r.address);
}
