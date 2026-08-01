import "server-only";
import { db } from "./db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Human-facing reference numbers (INV-1042 / TRX-1042). They are allocated from
 * a Postgres sequence rather than "max + 1" so two concurrent requests can never
 * be handed the same number.
 */
const SEQUENCES = {
  invoice: { seq: "afa_invoice_seq", prefix: "INV", start: 1042 },
  send: { seq: "afa_send_seq", prefix: "SND", start: 2008 },
  settlement: { seq: "afa_settlement_seq", prefix: "SET", start: 1008 },
  trx: { seq: "afa_trx_seq", prefix: "TRX", start: 3008 },
} as const;

export type RefKind = keyof typeof SEQUENCES;

async function nextValue(client: Prisma.TransactionClient, kind: RefKind): Promise<number> {
  const { seq, start } = SEQUENCES[kind];
  await client.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS "${seq}" START WITH ${start + 1}`,
  );
  const rows = await client.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${seq}"') AS nextval`,
  );
  return Number(rows[0]!.nextval);
}

export async function nextRef(
  kind: Exclude<RefKind, "trx">,
  client: Prisma.TransactionClient = db,
): Promise<{ ref: string; trxRef: string }> {
  const [n, t] = await Promise.all([nextValue(client, kind), nextValue(client, "trx")]);
  return { ref: `${SEQUENCES[kind].prefix}-${n}`, trxRef: `TRX-${t}` };
}
