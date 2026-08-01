"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/shared/Logo";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/cn";

import { USER_NAV } from "./Sidebar";
const NAV = USER_NAV;

export function MobileNav() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0 flex flex-col">
        <SheetHeader>
          <SheetTitle className="sr-only">منو</SheetTitle>
          <Logo />
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
            asChild
            onClick={() => {
              logout();
              setOpen(false);
            }}
          >
            <Link href="/login">
              <LogOut className="h-4 w-4" />
              <span>خروج</span>
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
