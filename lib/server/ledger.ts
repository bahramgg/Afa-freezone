import "server-only";
import { db } from "./db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, LedgerAccount, LedgerUnit } from "@/lib/generated/prisma/client";

/**
 * The gateway's books.
 *
 * One pile of tokens sits in the bank's wallets with several owners: money the
 * merchants are still owed, the fee the gateway has earned and owes a share of
 * to the Free Zone Organization, and what the bank has bought outright. A
 * single balance cannot be reconciled against any of that, so every movement is
 * written here as it happens and balances are always summed from the entries —
 * never stored, so a wrong figure can be traced to the entry that caused it.
 *
 * These entries follow money, not intent. Nothing is written until the chain or
 * the bank has confirmed the movement it describes.
 */

export type Posting = {
  account: LedgerAccount;
  amount: Prisma.Decimal | string | number;
  unit: LedgerUnit;
  userId?: string | null;
  note?: string | null;
};

type Context = {
  kind: string;
  subject: "invoice" | "send" | "settlement" | "deposit";
  subjectId: string;
  subjectRef: string;
};

/** Writes a group of postings for one event, in a single transaction. */
export async function post(
  context: Context,
  postings: Posting[],
  client: Prisma.TransactionClient = db,
): Promise<void> {
  const rows = postings
    .filter((p) => !new Prisma.Decimal(p.amount).isZero())
    .map((p) => ({
      account: p.account,
      amount: new Prisma.Decimal(p.amount),
      unit: p.unit,
      kind: context.kind,
      subject: context.subject,
      subjectId: context.subjectId,
      subjectRef: context.subjectRef,
      userId: p.userId ?? null,
      note: p.note ?? null,
    }));

  if (rows.length === 0) return;
  await client.ledgerEntry.createMany({ data: rows });
}

/** True when this event has already been written, so a retry cannot double it. */
export async function alreadyPosted(
  kind: string,
  subjectId: string,
  client: Prisma.TransactionClient = db,
): Promise<boolean> {
  const existing = await client.ledgerEntry.findFirst({
    where: { kind, subjectId },
    select: { id: true },
  });
  return existing !== null;
}

export type Balance = { account: LedgerAccount; unit: LedgerUnit; amount: string };

/** Current position of every account, summed from the entries. */
export async function balances(): Promise<Balance[]> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["account", "unit"],
    _sum: { amount: true },
    orderBy: [{ account: "asc" }, { unit: "asc" }],
  });
  return rows.map((r) => ({
    account: r.account,
    unit: r.unit,
    amount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(8),
  }));
}

/** What a single merchant is still owed, per token. */
export async function merchantPayable(userId: string): Promise<Record<string, string>> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["unit"],
    where: { account: "MERCHANT_PAYABLE", userId },
    _sum: { amount: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.unit, (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(8)]),
  );
}

/**
 * Splits the gateway fee between us and the Free Zone Organization.
 *
 * The organization's share is taken off the top of the fee, not off the
 * payment: the merchant pays one fee either way and never sees the split.
 */
export function splitGatewayFee(
  fee: Prisma.Decimal | string | number,
  freezonePercent: Prisma.Decimal | number,
): { gateway: Prisma.Decimal; freezone: Prisma.Decimal } {
  const total = new Prisma.Decimal(fee);
  const percent = new Prisma.Decimal(freezonePercent);
  const freezone = total.mul(percent).div(100).toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);
  // Rounding goes to us, so the two shares always add back to the fee exactly
  // and the organization is never credited a rial more than the rule allows.
  return { gateway: total.minus(freezone), freezone };
}

/** The unit a token amount is denominated in. */
export const unitFor = (currency: Currency): LedgerUnit => currency as LedgerUnit;

/**
 * The bank's margin on an exchange, in rial.
 *
 * Selling currency to an importer, the bank earns by locking a rate above the
 * reference; buying it from an exporter, by locking one below. A negative
 * figure means the bank gave a better rate than the reference — recorded as it
 * stands rather than clamped, because that is what happened.
 */
export function bankSpread(input: {
  side: "sell" | "buy";
  lockedRate: Prisma.Decimal | number | string;
  referenceRate: Prisma.Decimal | number | string;
  tokenAmount: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  const locked = new Prisma.Decimal(input.lockedRate);
  const reference = new Prisma.Decimal(input.referenceRate);
  const perToken = input.side === "sell" ? locked.minus(reference) : reference.minus(locked);
  return perToken.mul(new Prisma.Decimal(input.tokenAmount)).toDecimalPlaces(2);
}
