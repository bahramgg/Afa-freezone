"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/stores/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  return <>{children}</>;
}
