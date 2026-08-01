import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Rial arithmetic.
 *
 * Amounts are Decimal(38,18) in the database precisely so they do not drift.
 * Converting one to a JS number to multiply by a rate throws that away — a
 * double carries 15–16 significant digits, and a rial figure is already eight
 * or nine of them before the token amount contributes any. Multiplying in
 * Decimal keeps the product exact and rounds once, at the end.
 */
export function toRial(
  rate: Prisma.Decimal | number | string,
  amount: Prisma.Decimal | number | string,
): string {
  return new Prisma.Decimal(rate).mul(new Prisma.Decimal(amount)).toFixed(2);
}
