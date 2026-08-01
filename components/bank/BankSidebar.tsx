"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Building2,
  Home,
  LineChart,
  LogOut,
  Send,
  Settings as SettingsIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { useBankStore } from "@/lib/stores/bank";
import { cn } from "@/lib/cn";

export const BANK_NAV = [
  { href: "/bank/dashboard", label: "داشبورد", icon: Home },
  { href: "/bank/send", label: "ارسال وجه", icon: Send },
  { href: "/bank/settlement", label: "تسویه", icon: Banknote },
  { href: "/bank/wallets", label: "کیف پول‌های بانک", icon: WalletIcon },
  { href: "/bank/reports", label: "گزارشات", icon: LineChart },
  { href: "/bank/settings", label: "تنظیمات", icon: SettingsIcon },
] as const;

export function BankSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useBankStore((s) => s.logoutBank);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-s border-white/10 bg-emerald-950 text-emerald-50 sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
        <Logo withText size={32} className="[&_span]:text-white [&_span_.text-primary]:text-emerald-300" />
      </div>
      <div className="px-5 py-3 border-b border-white/10 text-xs flex items-center gap-2 text-emerald-300">
        <Building2 className="h-4 w-4" />
        پنل بانک عامل
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {BANK_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-emerald-700 text-white font-medium"
                  : "text-emerald-200 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-emerald-200 hover:bg-white/5 hover:text-destructive"
          onClick={() => {
            logout();
            router.replace("/bank/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </aside>
  );
}
