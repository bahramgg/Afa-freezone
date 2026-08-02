"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Home,
  LineChart,
  LogOut,
  Receipt,
  Settings as SettingsIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { useForeignStore } from "@/lib/stores/foreign";
import { cn } from "@/lib/cn";

export const FOREIGN_NAV = [
  { href: "/foreign/dashboard", label: "داشبورد", icon: Home },
  { href: "/foreign/invoices", label: "درخواست‌های پرداخت", icon: FileText },
  { href: "/foreign/imports", label: "فاکتورهای فروش", icon: Receipt },
  { href: "/foreign/wallets", label: "مدیریت والت", icon: WalletIcon },
  { href: "/foreign/reports", label: "گزارشات", icon: LineChart },
  { href: "/foreign/settings", label: "تنظیمات", icon: SettingsIcon },
] as const;

export function ForeignSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useForeignStore((s) => s.logout);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-s border-border bg-card sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-border">
        <Logo />
        <div className="mt-2 text-xs text-muted-foreground">International Panel</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {FOREIGN_NAV.map(({ href, label, icon: Icon }) => {
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
          onClick={() => {
            logout();
            router.replace("/");
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>خروج از پنل</span>
        </Button>
      </div>
    </aside>
  );
}
