"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedSettings } from "../mock/fixtures";
import type { Settings } from "../types";

type SettingsState = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const SLICE = "settings";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: seedSettings(),
      update: (patch) => {
        set({ settings: { ...get().settings, ...patch } });
        broadcast(SLICE, { settings: get().settings });
      },
    }),
    { name: "afa-demo:settings", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    const p = payload as { settings?: Settings };
    if (p?.settings) useSettingsStore.setState({ settings: p.settings }, false);
  });
}
