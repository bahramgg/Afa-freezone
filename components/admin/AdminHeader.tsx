"use client";

import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AdminMobileNav } from "./AdminMobileNav";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur border-b border-white/10 text-slate-100">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <AdminMobileNav />
          <Badge tone="primary" className="gap-1.5 bg-primary text-primary-foreground border-transparent">
            <Crown className="h-3 w-3" />
            پنل ادمین
          </Badge>
          <span className="hidden sm:inline text-sm text-slate-400">منطقه آزاد گلستان</span>
        </div>
        <div className="text-xs text-slate-400">
          ادمین سیستم
        </div>
      </div>
    </header>
  );
}
