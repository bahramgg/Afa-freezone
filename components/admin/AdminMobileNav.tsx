"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/shared/Logo";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/cn";
import { ADMIN_NAV } from "./AdminSidebar";

export function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logoutAdmin = useAuthStore((s) => s.logoutAdmin);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="منو"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0 flex flex-col bg-slate-950 text-slate-100 border-white/10">
        <SheetHeader className="border-white/10">
          <SheetTitle className="sr-only">منو ادمین</SheetTitle>
          <Logo withText size={32} className="[&_span]:text-white [&_span_.text-primary]:text-primary/80" />
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
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
            className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-destructive"
            onClick={() => {
              logoutAdmin();
              setOpen(false);
              router.replace("/admin/login");
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
