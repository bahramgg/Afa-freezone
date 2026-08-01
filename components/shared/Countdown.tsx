"use client";

import { useEffect, useState } from "react";
import { toPersianDigits } from "@/lib/format";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "۰۰:۰۰";
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return toPersianDigits(`${m}:${s}`);
}

export function Countdown({
  to,
  onExpire,
  className,
}: {
  to: string;
  onExpire?: () => void;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(to).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, new Date(to).getTime() - Date.now());
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [to, onExpire]);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRemaining(remaining)}
    </span>
  );
}
