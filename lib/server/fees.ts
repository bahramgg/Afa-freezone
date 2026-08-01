import "server-only";
import { db } from "./db";

export type FeeBreakdown = {
  /** What the payer sent. */
  gross: number;
  fee: number;
  /** What the merchant is credited. Never negative. */
  net: number;
};

/**
 * Splits a received amount into fee and net.
 *
 * The configured floor (`feeMin`) exists to stop a percentage fee rounding to
 * nothing on small transfers, but it must never exceed the transfer itself —
 * without the final clamp a payment smaller than the floor produces a negative
 * payout, which is what a small invoice did in testing.
 */
export function splitFee(
  gross: number,
  settings: { feeBasePercent: number; feeMin: number; feeMax: number },
): FeeBreakdown {
  if (!Number.isFinite(gross) || gross <= 0) return { gross: 0, fee: 0, net: 0 };

  const percentage = (gross * settings.feeBasePercent) / 100;
  const withFloor = Math.max(percentage, settings.feeMin);
  const withCeiling = Math.min(withFloor, settings.feeMax);
  const fee = Math.min(withCeiling, gross);

  return { gross, fee, net: gross - fee };
}

/** Reads the live settings row and applies them. */
export async function feeFor(gross: number): Promise<FeeBreakdown> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return splitFee(gross, {
    feeBasePercent: Number(settings?.feeBasePercent ?? 2),
    feeMin: Number(settings?.feeMin ?? 0),
    feeMax: Number(settings?.feeMax ?? Number.POSITIVE_INFINITY),
  });
}
