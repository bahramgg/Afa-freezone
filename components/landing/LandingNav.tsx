"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { useThemeStore } from "@/lib/stores/theme";
import { useHydrated } from "@/lib/stores/hydration";
import "@/lib/devtools/reset";

export function LandingNav() {
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const hydrated = useHydrated();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-3" aria-label="صفحه اصلی">
          <Logo size={30} />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            سامانه پرداخت ارزی
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {hydrated && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
