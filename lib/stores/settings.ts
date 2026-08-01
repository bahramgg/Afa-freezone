"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import { seedSettings } from "../mock/fixtures";
import type { Settings } from "../types";

const SLICE = "settings";

type SettingsState = {
  settings: Settings;
  loaded: boolean;

  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  // Seed values stand in only until the first fetch resolves, so forms that
  // read a rate on first paint never see undefined.
  settings: seedSettings(),
  loaded: false,

  load: async () => {
    try {
      const { settings } = await api.get<{ settings: Settings }>("/settings");
      set({ settings, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  update: async (patch) => {
    const { settings } = await api.patch<{ settings: Settings }>("/settings", patch);
    set({ settings });
    pingReload(SLICE);
  },
}));

onReload(SLICE, () => useSettingsStore.getState().load());
