"use client";

import { useCallback } from "react";
import { useSettingsStore } from "./stores/settings";

/**
 * Adding two currencies together.
 *
 * A total that mixes the settled token with the chain's native coin has to
 * convert one into the other, and the pages that show such a total each used to
 * pick a multiplier out of the air — 600 on the organization's reports, 280 on
 * the bank's, for the same coin on the same day. Two panels reporting different
 * volumes for the same rows is worse than either number being wrong.
 *
 * So the conversion comes from the two rates the organization itself sets in
 * settings. Both are quoted in rial, so their ratio is how many tokens the
 * native coin is worth, and it moves when the organization moves it.
 */
export function useInToken() {
  const settings = useSettingsStore((s) => s.settings);
  const { usdtRate, bnbRate } = settings;

  return useCallback(
    (amount: number, currency: string) => {
      if (currency === "USDT") return amount;
      if (!usdtRate || !bnbRate) return 0;
      return amount * (bnbRate / usdtRate);
    },
    [usdtRate, bnbRate],
  );
}
