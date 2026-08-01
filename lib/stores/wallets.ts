"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedWallets } from "../mock/fixtures";
import type { Wallet } from "../types";

type WalletsState = {
  list: Wallet[];
  add: (w: Omit<Wallet, "verified" | "verifiedAt" | "network">) => Wallet;
  remove: (address: string) => void;
};

const SLICE = "wallets";

export const useWalletsStore = create<WalletsState>()(
  persist(
    (set, get) => ({
      list: seedWallets(),
      add: (w) => {
        const wallet: Wallet = {
          ...w,
          network: "BSC",
          verified: true,
          verifiedAt: new Date().toISOString(),
        };
        set({ list: [...get().list, wallet] });
        broadcast(SLICE, { list: get().list });
        return wallet;
      },
      remove: (address) => {
        set({ list: get().list.filter((w) => w.address !== address) });
        broadcast(SLICE, { list: get().list });
      },
    }),
    { name: "afa-demo:wallets", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    const p = payload as { list?: Wallet[] };
    if (p?.list) useWalletsStore.setState({ list: p.list }, false);
  });
}
