"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { KeyRound, ListTree, LogOut, Users } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/lib/stores/auth";
import { useHydrated } from "@/lib/stores/hydration";
import { cn } from "@/lib/cn";

export const SYSTEM_NAV = [
  { href: "/system/users", label: "کاربران", icon: Users },
  { href: "/system/logs", label: "گزارش رویدادها", icon: ListTree },
  { href: "/system/access", label: "دسترسی ثبت‌نام", icon: KeyRound },
] as const;

/**
 * The system panel's frame and its own gate.
 *
 * Guarded here rather than by the shared route guards on purpose: this panel is
 * never opened by the link-only mode, so it does not adopt an identity for
 * whoever arrives. Being a system administrator is something you sign in as.
 */
export function SystemShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const ready = useAuthStore((s) => s.ready);
  const logout = useAuthStore((s) => s.logout);
  const hydrated = useHydrated() && ready;

  useEffect(() => {
    if (hydrated && role !== "SUPERADMIN") router.replace("/login");
  }, [hydrated, role, router]);

  if (!hydrated || role !== "SUPERADMIN") {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-s border-white/10 lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Logo />
          <p className="mt-2 text-[11px] text-slate-400">مدیریت سیستم</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {SYSTEM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
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
            className="w-full justify-start text-slate-400 hover:bg-white/5 hover:text-destructive"
            onClick={() => {
              void logout();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 overflow-x-auto border-b border-white/10 px-4 py-3 lg:hidden">
          {SYSTEM_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                pathname === href ? "bg-white/10 text-white" : "text-slate-400",
              )}
            >
              {label}
            </Link>
          ))}
        </header>
        <main className="flex-1 p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
