import { dayjs } from "./jalali";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function formatCurrency(amount: number, currency: "USDT" | "BNB" | "IRR" = "USDT"): string {
  const formatted = new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export function formatAmount(n: number): string {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatJalali(iso: string | Date, withTime = false): string {
  const d = dayjs(iso).calendar("jalali").locale("fa");
  return withTime ? d.format("YYYY/MM/DD — HH:mm") : d.format("YYYY/MM/DD");
}

export function fromNow(iso: string | Date): string {
  const target = dayjs(iso);
  const diffMs = dayjs().diff(target);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه قبل`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت قبل`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${toPersianDigits(days)} روز قبل`;
  return formatJalali(iso);
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function truncateHash(hash: string): string {
  return truncateAddress(hash, 8, 6);
}

export function bscScanUrl(hashOrAddr: string, type: "tx" | "address" = "tx"): string {
  return `https://bscscan.com/${type}/${hashOrAddr}`;
}
