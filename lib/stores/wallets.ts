"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { Wallet } from "../types";

const SLICE = "wallets";

type WalletsState = {
  list: Wallet[];
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  add: (input: { address: string; label?: string }) => Promise<Wallet>;
  remove: (id: string) => Promise<void>;
};

export const useWalletsStore = create<WalletsState>()((set, get) => ({
  list: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: Wallet[] }>("/wallets?scope=mine");
      set({ list, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  add: async (input) => {
    const { wallet } = await api.post<{ wallet: Wallet }>("/wallets", {
      ...input,
      scope: "mine",
    });
    set({ list: [...get().list, wallet] });
    pingReload(SLICE);
    return wallet;
  },

  remove: async (id) => {
    await api.delete(`/wallets/${id}`);
    set({ list: get().list.filter((w) => w.id !== id) });
    pingReload(SLICE);
  },
}));

onReload(SLICE, () => useWalletsStore.getState().load());
