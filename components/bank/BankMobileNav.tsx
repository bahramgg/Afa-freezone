"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/shared/Logo";
import { useBankStore } from "@/lib/stores/bank";
import { cn } from "@/lib/cn";
import { BANK_NAV } from "./BankSidebar";

export function BankMobileNav() {
  const pathname = usePathname();
  const logout = useBankStore((s) => s.logoutBank);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden text-emerald-100 hover:bg-white/10" aria-label="منو">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0 flex flex-col bg-emerald-950 text-emerald-50 border-emerald-900">
        <SheetHeader>
          <SheetTitle className="sr-only">منو</SheetTitle>
          <Logo withText className="[&_span]:text-white [&_span_.text-primary]:text-emerald-300" />
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {BANK_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
            className="w-full justify-start text-emerald-200 hover:text-destructive"
            onClick={() => {
              logout();
              setOpen(false);
              router.replace("/bank/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
