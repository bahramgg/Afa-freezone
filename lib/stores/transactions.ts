"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload } from "./_sync";
import type { Transaction } from "../types";

const SLICE = "transactions";

type TxState = {
  list: Transaction[];
  loading: boolean;
  loaded: boolean;
  load: (opts?: { status?: string; unmatched?: boolean }) => Promise<void>;
};

export const useTxStore = create<TxState>()((set) => ({
  list: [],
  loading: false,
  loaded: false,

  load: async (opts) => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: Transaction[] }>(
        `/transactions${query({
          status: opts?.status,
          unmatched: opts?.unmatched ? "true" : undefined,
        })}`,
      );
      set({ list, loaded: true });
    } catch {
      set({ list: [], loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));

onReload(SLICE, () => useTxStore.getState().load());
