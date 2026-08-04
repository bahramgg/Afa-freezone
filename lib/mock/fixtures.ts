// The settings placeholder, and nothing else.
//
// This file used to hold the chart series for every panel — invented volumes,
// six fixed month names, a thirty-day exchange-rate curve the system never
// recorded. Those are gone: charts are counted from real rows in `lib/series.ts`,
// and the rate chart was removed rather than filled in.
import type { Settings } from "../types";

export const DEFAULT_USDT_RATE = 66800;
export const DEFAULT_BNB_RATE = 222000;

export function seedSettings(): Settings {
  return {
    feeBasePercent: 2,
    feeMin: 1,
    feeMax: 50,
    invoiceValidityMinutes: 30,
    invoiceMinAmount: 10,
    invoiceMaxAmount: 10000,
    usdtRate: DEFAULT_USDT_RATE,
    bnbRate: DEFAULT_BNB_RATE,
    dailySendLimit: 10000,
    dailySettlementLimit: 10000,
    minTxAmount: 10,
    rateTolerancePercent: 10,
    freezoneSharePercent: 50,
  };
}
