// Chart series and the settings placeholder. Everything else that used to live
// here is now owned by the database and reaches the client through the API.
import type { Settings } from "../types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

export const DEFAULT_USDT_RATE = 66800;
export const DEFAULT_BNB_RATE = 222000;

export function activitySeries(days = 30) {
  const out: { date: string; received: number; sent: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(NOW - i * DAY);
    const seed = (i * 9301 + 49297) % 233280;
    const received = Math.round(((seed % 800) + 100) * (1 + Math.sin(i / 4) * 0.4));
    const sent = Math.round(((seed % 500) + 60) * (1 + Math.cos(i / 5) * 0.3));
    out.push({ date: date.toISOString(), received, sent });
  }
  return out;
}

export function userGrowthSeries(months = 6) {
  const labels = ["شهریور", "مهر", "آبان", "آذر", "دی", "بهمن"];
  const values = [14, 22, 18, 26, 31, 37];
  return labels.slice(0, months).map((m, i) => ({
    month: m,
    users: values[i] ?? 0,
  }));
}

export function adminVolumeSeries(months = 6) {
  const labels = ["شهریور", "مهر", "آبان", "آذر", "دی", "بهمن"];
  const receivedSeries = [8200, 11400, 9600, 14200, 12800, 15600];
  const sentSeries = [5100, 7800, 6300, 9400, 8100, 11200];
  return labels.slice(0, months).map((m, i) => ({
    month: m,
    received: receivedSeries[i] ?? 0,
    sent: sentSeries[i] ?? 0,
    volume: (receivedSeries[i] ?? 0) + (sentSeries[i] ?? 0),
  }));
}

export function bankVolumeSeries(months = 6) {
  const labels = ["شهریور", "مهر", "آبان", "آذر", "دی", "بهمن"];
  const send = [420, 580, 490, 690, 720, 820];
  const settle = [380, 520, 440, 620, 680, 790];
  return labels.slice(0, months).map((m, i) => ({
    month: m,
    send: send[i] ?? 0,
    settle: settle[i] ?? 0,
  }));
}

export function usdtRateSeries(days = 30) {
  const data = [
    62400, 62800, 63200, 63800, 64100, 64500, 64900,
    65200, 65800, 65500, 65900, 66200, 66000, 66400,
    66800, 66500, 67100, 67400, 67000, 67800, 68200,
    67900, 68400, 68100, 67600, 67200, 66800, 66500,
    66100, 66800,
  ];
  return data.slice(0, days).map((v, i) => ({
    day: i + 1,
    rate: v,
  }));
}

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
