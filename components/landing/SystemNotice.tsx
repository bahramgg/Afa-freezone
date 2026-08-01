"use client";

import { ShieldAlert } from "lucide-react";
import { formatJalali } from "@/lib/format";
import { useHydrated } from "@/lib/stores/hydration";

/**
 * Standing notice for an internal system: who may use it, and that access is
 * logged. Rendered after hydration because the date is client-local.
 */
export function SystemNotice() {
  const hydrated = useHydrated();

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1 text-xs leading-6 text-muted-foreground">
          <p>
            دسترسی به این سامانه محدود به کاربران مجاز است. ورود و تمام عملیات انجام‌شده
            ثبت و نگهداری می‌شود.
          </p>
          <p>
            در صورت مشاهده هرگونه مغایرت در تراکنش‌ها، پیش از اقدام با واحد پشتیبانی
            تماس بگیرید.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>
          تاریخ امروز: <span className="tabular-nums">{hydrated ? formatJalali(new Date()) : "—"}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          سرویس در دسترس است
        </span>
      </div>
    </div>
  );
}
