"use client";

import Link from "next/link";
import { ChevronDown, Moon, ShieldCheck, Sun, User as UserIcon, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Badge } from "@/components/ui/Badge";
import { NotificationsPanel } from "./NotificationsPanel";
import { MobileNav } from "./MobileNav";
import { useAuthStore } from "@/lib/stores/auth";
import { useThemeStore } from "@/lib/stores/theme";
import { useHydrated } from "@/lib/stores/hydration";

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const hydrated = useHydrated();

  const initials = user?.fullName
    ? user.fullName
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
    : "؟";

  return (
    <header className="sticky top-0 z-30 glass border-b border-border">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <MobileNav />
          {hydrated && user ? (
            <Badge tone="success" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              KYC تأیید شده
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="tap-grow flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={isDark ? "حالت روشن" : "حالت تاریک"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <NotificationsPanel />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="tap-grow flex items-center gap-2 rounded-md p-1 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    style={{ background: user?.avatarColor }}
                    className="text-white"
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-end hidden sm:block">
                  <div className="text-xs font-medium leading-tight">
                    {hydrated && user ? user.fullName : "..."}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {hydrated && user ? user.uid : ""}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>حساب کاربری</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  پروفایل
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  تنظیمات
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/"
                  onClick={() => logout()}
                  className="flex items-center gap-2 text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  خروج از پنل
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
