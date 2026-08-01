import "server-only";
import { db } from "./db";

/**
 * The gateway fee.
 *
 * There is exactly one fee in the system and it is taken exactly once per
 * journey the money makes. A payment that arrives on an invoice and is then
 * paid out to the merchant in rial is one journey, not two: the fee comes off
 * the invoice, and the settlement it produces charges nothing.
 *
 * The fee is always borne by the Iranian merchant, because they are the party
 * the free zone is providing the service to. That means it comes off what they
 * receive, or goes on top of what they pay — never off the amount the foreign
 * counterparty was promised.
 */

/** Which side of the merchant's ledger the fee falls on. */
export type FeeSide =
  /** The merchant receives: they are credited the amount less the fee. */
  | "credit"
  /** The merchant pays: they are charged the amount plus the fee. */
  | "debit";

export type FeeBreakdown = {
  /** The amount the flow is denominated in, before the fee. */
  gross: number;
  fee: number;
  /**
   * The merchant's side of the ledger — what the rial leg is computed from.
   * Credit: gross − fee, never negative. Debit: gross + fee.
   */
  net: number;
};

export type FeeSettings = { feeBasePercent: number; feeMin: number; feeMax: number };

/**
 * Applies the percentage between its floor and ceiling.
 *
 * The floor (`feeMin`) exists to stop a percentage fee rounding to nothing on
 * small transfers, but on a credit it must never exceed the transfer itself —
 * without the final clamp a payment smaller than the floor produces a negative
 * payout, which is what a small invoice did in testing.
 */
export function splitFee(gross: number, settings: FeeSettings, side: FeeSide = "credit"): FeeBreakdown {
  if (!Number.isFinite(gross) || gross <= 0) return { gross: 0, fee: 0, net: 0 };

  const percentage = (gross * settings.feeBasePercent) / 100;
  const withFloor = Math.max(percentage, settings.feeMin);
  const withCeiling = Math.min(withFloor, settings.feeMax);
  // A debit adds the fee on top, so there is nothing for it to exceed.
  const fee = side === "credit" ? Math.min(withCeiling, gross) : withCeiling;

  return { gross, fee, net: side === "credit" ? gross - fee : gross + fee };
}

/** The fee that is not charged, for a leg whose journey already paid one. */
export const NO_FEE = (gross: number): FeeBreakdown => ({ gross, fee: 0, net: gross });

/** Reads the live settings row and applies them. */
export async function feeFor(gross: number, side: FeeSide = "credit"): Promise<FeeBreakdown> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return splitFee(
    gross,
    {
      feeBasePercent: Number(settings?.feeBasePercent ?? 2),
      feeMin: Number(settings?.feeMin ?? 0),
      feeMax: Number(settings?.feeMax ?? Number.POSITIVE_INFINITY),
    },
    side,
  );
}
