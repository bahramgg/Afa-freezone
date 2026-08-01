import "server-only";
import { db } from "./db";
import { badRequest } from "./http";
import type { Currency } from "@/lib/generated/prisma/client";

/** The reference rate a bank-locked rate is judged against, and priced from. */
export async function referenceRate(currency: Currency): Promise<number> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) return 0;
  return Number(currency === "BNB" ? settings.bnbRate : settings.usdtRate);
}

/**
 * Guards the exchange rate a bank operator types by hand.
 *
 * The rate is locked once and cannot be edited afterwards, so a slip of one
 * digit is not a small mistake: at 66,800 rial a 120 USDT request costs
 * 8,016,000 rial, and at 668,000 it costs 80,160,000. The only way back is to
 * reject the whole request and start again.
 *
 * Settings carries a reference rate per currency. Anything further from it than
 * the configured tolerance is refused, with the numbers spelled out so the
 * operator can see what they typed against what was expected.
 */
export async function assertRateWithinTolerance(rate: number, currency: Currency): Promise<void> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) return;

  const reference = Number(currency === "BNB" ? settings.bnbRate : settings.usdtRate);
  const tolerance = Number(settings.rateTolerancePercent);
  // A reference of zero means none has been set; there is nothing to compare to.
  if (!(reference > 0) || !(tolerance > 0)) return;

  const drift = (Math.abs(rate - reference) / reference) * 100;
  if (drift <= tolerance) return;

  const low = Math.round(reference * (1 - tolerance / 100));
  const high = Math.round(reference * (1 + tolerance / 100));
  throw badRequest(
    `نرخ واردشده ${Math.round(drift)}٪ با نرخ مرجع (${reference}) فاصله دارد. ` +
      `بازهٔ مجاز ${low} تا ${high} است — نرخ را بررسی کنید یا نرخ مرجع را در تنظیمات به‌روز کنید.`,
  );
}
