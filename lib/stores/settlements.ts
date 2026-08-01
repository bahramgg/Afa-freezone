"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { Currency, Settlement, SettlementStatus } from "../types";

const SLICE = "settlements";

type SettlementsState = {
  list: Settlement[];
  loading: boolean;
  loaded: boolean;

  load: (opts?: { status?: SettlementStatus | "ALL" }) => Promise<void>;
  create: (input: {
    goodsTitle: string;
    description: string;
    amount: number;
    currency: Currency;
    walletAddress: string;
    bankAccount: string;
  }) => Promise<Settlement>;

  adminApprove: (ref: string) => Promise<void>;
  adminReject: (ref: string, reason: string) => Promise<void>;
  lockBankRate: (ref: string, rate: number, bankWalletAddress: string) => Promise<void>;
  /** Merchant reports the transfer they made to the bank's wallet. */
  submitUserTx: (ref: string, txHash: string) => Promise<void>;
  settle: (ref: string, receiptNo: string, note?: string) => Promise<void>;
  bankReject: (ref: string, reason: string) => Promise<void>;

  byStatus: (s: SettlementStatus | "ALL") => Settlement[];
  byId: (ref: string) => Settlement | undefined;
  byTrx: (trx: string) => Settlement | undefined;
};

function replace(list: Settlement[], next: Settlement) {
  const i = list.findIndex((x) => x.id === next.id);
  if (i === -1) return [next, ...list];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

export const useSettlementsStore = create<SettlementsState>()((set, get) => {
  async function transition(ref: string, payload: Record<string, unknown>) {
    const { settlement } = await api.post<{ settlement: Settlement }>(
      `/settlements/${ref}/transition`,
      payload,
    );
    set({ list: replace(get().list, settlement) });
    pingReload(SLICE);
  }

  return {
    list: [],
    loading: false,
    loaded: false,

    load: async (opts) => {
      set({ loading: true });
      try {
        const { list } = await api.get<{ list: Settlement[] }>(
          `/settlements${query({ status: opts?.status })}`,
        );
        set({ list, loaded: true });
      } finally {
        set({ loading: false });
      }
    },

    create: async (input) => {
      const { settlement } = await api.post<{ settlement: Settlement }>("/settlements", input);
      set({ list: [settlement, ...get().list] });
      pingReload(SLICE);
      return settlement;
    },

    adminApprove: (ref) => transition(ref, { action: "approveAdmin" }),
    adminReject: (ref, reason) => transition(ref, { action: "rejectAdmin", reason }),
    lockBankRate: (ref, rate, bankWalletAddress) =>
      transition(ref, { action: "lockRate", rate, bankWalletAddress }),
    submitUserTx: (ref, txHash) => transition(ref, { action: "submitPayoutTx", txHash }),
    settle: (ref, receiptNo, note) => transition(ref, { action: "settle", receiptNo, note }),
    bankReject: (ref, reason) => transition(ref, { action: "rejectBank", reason }),

    byStatus: (s) => (s === "ALL" ? get().list : get().list.filter((i) => i.status === s)),
    byId: (ref) => get().list.find((s) => s.id === ref),
    byTrx: (trx) => get().list.find((s) => s.trxId === trx),
  };
});

onReload(SLICE, () => useSettlementsStore.getState().load());
