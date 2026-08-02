"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivitySquare,
  Scale,
  Undo2,
  Banknote,
  Crown,
  FileCheck2,
  LineChart,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/stores/auth";
import { useKycStore } from "@/lib/stores/kyc";
import { cn } from "@/lib/cn";

export const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "داشبورد", icon: Crown },
  { href: "/admin/users", label: "مدیریت کاربران", icon: Users },
  { href: "/admin/kyc", label: "احراز هویت کاربران", icon: ShieldCheck },
  { href: "/admin/invoices", label: "دریافت وجه", icon: FileCheck2 },
  { href: "/admin/settlements", label: "تسویه", icon: Banknote },
  { href: "/admin/transactions", label: "مدیریت تراکنش‌ها", icon: ActivitySquare },
  { href: "/admin/refunds", label: "بازگشت وجه", icon: Undo2 },
  { href: "/admin/ledger", label: "دفتر کل", icon: Scale },
  { href: "/admin/reports", label: "گزارشات", icon: LineChart },
  { href: "/admin/settings", label: "تنظیمات", icon: SettingsIcon },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logoutAdmin = useAuthStore((s) => s.logout);
  const pendingKyc = useKycStore((s) => s.requests.filter((r) => r.kyc === "PENDING").length);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-s border-white/10 bg-slate-950 text-slate-100 sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
        <Logo withText size={32} className="[&_span]:text-white [&_span_.text-primary]:text-primary/80" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const badge = href === "/admin/kyc" && pendingKyc > 0 ? pendingKyc : null;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white leading-none">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-destructive"
          onClick={() => {
            logoutAdmin();
            router.replace("/");
          }}
        >
          <LogOut className="h-4 w-4" />
          خروج از پنل
        </Button>
      </div>
    </aside>
  );
}
