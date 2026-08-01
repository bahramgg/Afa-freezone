"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedBankWallets } from "../mock/fixtures";
import type { BankWallet } from "../types";

type BankState = {
  isBankAuthed: boolean;
  wallets: BankWallet[];
  loginBank: () => void;
  logoutBank: () => void;
  addWallet: (w: Omit<BankWallet, "createdAt" | "network" | "usdtBalance" | "bnbBalance" | "active">) => void;
  toggleWallet: (address: string) => void;
};

const SLICE = "bank";

type BankSnapshot = Pick<BankState, "isBankAuthed" | "wallets">;
const snapshot = (s: BankState): BankSnapshot => ({
  isBankAuthed: s.isBankAuthed,
  wallets: s.wallets,
});

export const useBankStore = create<BankState>()(
  persist(
    (set, get) => ({
      isBankAuthed: false,
      wallets: seedBankWallets(),
      loginBank: () => {
        set({ isBankAuthed: true });
        broadcast(SLICE, snapshot(get()));
      },
      logoutBank: () => {
        set({ isBankAuthed: false });
        broadcast(SLICE, snapshot(get()));
      },
      addWallet: (w) => {
        const wallet: BankWallet = {
          ...w,
          network: "BSC",
          usdtBalance: 0,
          bnbBalance: 0,
          active: true,
          createdAt: new Date().toISOString(),
        };
        set({ wallets: [...get().wallets, wallet] });
        broadcast(SLICE, snapshot(get()));
      },
      toggleWallet: (address) => {
        set({
          wallets: get().wallets.map((w) =>
            w.address === address ? { ...w, active: !w.active } : w,
          ),
        });
        broadcast(SLICE, snapshot(get()));
      },
    }),
    { name: "afa-demo:bank", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    if (!payload || typeof payload !== "object") return;
    useBankStore.setState(payload as Partial<BankState>, false);
  });
}
