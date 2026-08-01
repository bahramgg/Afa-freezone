"use client";

import { useHydrated } from "@/lib/stores/hydration";
import { formatJalali, fromNow, toPersianDigits } from "@/lib/format";

export function JalaliDate({
  iso,
  withTime = false,
  relative = false,
}: {
  iso: string;
  withTime?: boolean;
  relative?: boolean;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <span className="opacity-0">—</span>;
  const out = relative ? fromNow(iso) : toPersianDigits(formatJalali(iso, withTime));
  return <span>{out}</span>;
}
