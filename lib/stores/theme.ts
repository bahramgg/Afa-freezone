"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeState = {
  isDark: boolean;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((s) => ({ isDark: !s.isDark })),
    }),
    { name: "afa-demo:theme" }
  )
);
