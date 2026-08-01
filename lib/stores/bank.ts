"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { BankWallet, BankWalletKind } from "../types";

const SLICE = "bank";

type BankState = {
  wallets: BankWallet[];
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  addWallet: (input: { address: string; label: string; kind: BankWalletKind }) => Promise<void>;
  toggleWallet: (id: string, active: boolean) => Promise<void>;
};

export const useBankStore = create<BankState>()((set, get) => ({
  wallets: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: BankWallet[] }>("/wallets?scope=bank");
      set({ wallets: list, loaded: true });
    } catch {
      set({ wallets: [], loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addWallet: async ({ address, label, kind }) => {
    const { wallet } = await api.post<{ wallet: BankWallet }>("/wallets", {
      address,
      label,
      scope: "bank",
      bankKind: kind,
    });
    set({ wallets: [...get().wallets, wallet] });
    pingReload(SLICE);
  },

  toggleWallet: async (id, active) => {
    const { wallet } = await api.patch<{ wallet: BankWallet }>(`/wallets/${id}`, { active });
    set({ wallets: get().wallets.map((w) => (w.id === id ? wallet : w)) });
    pingReload(SLICE);
  },
}));

onReload(SLICE, () => useBankStore.getState().load());
