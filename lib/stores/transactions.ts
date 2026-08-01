"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedTransactions } from "../mock/fixtures";
import type { Transaction } from "../types";

type TxState = {
  list: Transaction[];
};

export const useTxStore = create<TxState>()(
  persist(
    () => ({ list: seedTransactions() }),
    { name: "afa-demo:transactions", version: 1 },
  ),
);
