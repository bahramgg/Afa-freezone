"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Banknote,
  FileText,
  Home,
  LineChart,
  LogOut,
  Settings as SettingsIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/cn";

export const USER_NAV = [
  { href: "/dashboard", label: "داشبورد", icon: Home },
  { href: "/receive", label: "صادرات (دریافت وجه)", icon: WalletIcon },
  { href: "/imports", label: "واردات (فاکتور فروشنده)", icon: FileText },
  // Retired, but still reachable: requests raised before it closed have to be
  // watchable until the bank finishes or rejects them.
  { href: "/send", label: "ارسال وجه (بازنشسته)", icon: Archive },
  { href: "/settlement", label: "تسویه ریالی", icon: Banknote },
  { href: "/wallets", label: "مدیریت والت", icon: WalletIcon },
  { href: "/reports", label: "گزارشات", icon: LineChart },
  { href: "/settings", label: "تنظیمات", icon: SettingsIcon },
] as const;

const NAV = USER_NAV;

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-s border-border bg-card sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-border">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={logout}
          asChild
        >
          <Link href="/login">
            <LogOut className="h-4 w-4" />
            <span>خروج</span>
          </Link>
        </Button>
      </div>
    </aside>
  );
}
