"use client";

import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BankMobileNav } from "./BankMobileNav";

export function BankHeader() {
  return (
    <header className="sticky top-0 z-30 bg-emerald-900/80 backdrop-blur border-b border-white/10 text-emerald-50">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <BankMobileNav />
          <Badge tone="success" className="gap-1.5 bg-emerald-700 text-white border-transparent">
            <Building2 className="h-3 w-3" />
            بانک عامل
          </Badge>
          <span className="hidden sm:inline text-sm text-emerald-300">منطقه آزاد</span>
        </div>
        <div className="text-xs text-emerald-300">مدیر عملیات ارزی</div>
      </div>
    </header>
  );
}
