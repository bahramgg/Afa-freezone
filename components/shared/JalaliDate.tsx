"use client";

import { useHydrated } from "@/lib/stores/hydration";
import { formatJalali, fromNow } from "@/lib/format";

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
  const out = relative ? fromNow(iso) : formatJalali(iso, withTime);
  return <span className="whitespace-nowrap tabular-nums">{out}</span>;
}
