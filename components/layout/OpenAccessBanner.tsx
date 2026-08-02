"use client";

import { ShieldOff } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth";

/**
 * States plainly that the deployment has no sign-in.
 *
 * Nothing about an open deployment looks different from a secured one from the
 * inside, which is exactly the problem: an operator seeing real invoices has no
 * way to tell that everyone else with the link is seeing them too. It renders
 * only while AUTH_OPEN_ACCESS is on, so a locked deployment carries no clutter.
 */
export function OpenAccessBanner() {
  const openAccess = useAuthStore((s) => s.openAccess);
  if (!openAccess) return null;

  return (
    <div className="flex items-start gap-2 bg-warning/15 px-4 py-2 text-xs leading-6 text-warning-foreground sm:items-center">
      <ShieldOff className="mt-1 h-3.5 w-3.5 shrink-0 sm:mt-0" />
      <span>
        ورود موقتاً غیرفعال است — هر کسی که این نشانی را داشته باشد وارد همین پنل می‌شود.
      </span>
    </div>
  );
}
