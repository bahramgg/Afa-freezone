"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { Currency, SendRequest, SendStatus } from "../types";

const SLICE = "send";

type SendState = {
  list: SendRequest[];
  loading: boolean;
  loaded: boolean;

  load: (opts?: { status?: SendStatus | "ALL" }) => Promise<void>;
  create: (input: {
    counterpartyUid: string;
    amount: number;
    currency: Currency;
    description?: string;
  }) => Promise<SendRequest>;

  /** Foreign counterparty confirms the wallet the crypto should land in. */
  approveCounterparty: (ref: string, walletAddress: string) => Promise<void>;
  approveAdmin: (ref: string) => Promise<void>;
  rejectAdmin: (ref: string, reason: string) => Promise<void>;
  lockBankRate: (ref: string, rate: number, depositAccount: string) => Promise<void>;
  confirmRialDeposit: (ref: string, receiptNo: string) => Promise<void>;
  /** The operator signs outside the system and reports the resulting hash. */
  recordCryptoSent: (ref: string, txHash: string, bankWalletAddress?: string) => Promise<void>;
  rejectBank: (ref: string, reason: string) => Promise<void>;

  byId: (ref: string) => SendRequest | undefined;
  byTrx: (trx: string) => SendRequest | undefined;
};

function replace(list: SendRequest[], next: SendRequest) {
  const i = list.findIndex((x) => x.id === next.id);
  if (i === -1) return [next, ...list];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

export const useSendStore = create<SendState>()((set, get) => {
  async function transition(ref: string, payload: Record<string, unknown>) {
    const { send } = await api.post<{ send: SendRequest }>(`/sends/${ref}/transition`, payload);
    set({ list: replace(get().list, send) });
    pingReload(SLICE);
  }

  return {
    list: [],
    loading: false,
    loaded: false,

    load: async (opts) => {
      set({ loading: true });
      try {
        const { list } = await api.get<{ list: SendRequest[] }>(
          `/sends${query({ status: opts?.status })}`,
        );
        set({ list, loaded: true });
      } finally {
        set({ loading: false });
      }
    },

    create: async (input) => {
      const { send } = await api.post<{ send: SendRequest }>("/sends", input);
      set({ list: [send, ...get().list] });
      pingReload(SLICE);
      return send;
    },

    approveCounterparty: (ref, walletAddress) =>
      transition(ref, { action: "acceptCounterparty", walletAddress }),
    approveAdmin: (ref) => transition(ref, { action: "approveAdmin" }),
    rejectAdmin: (ref, reason) => transition(ref, { action: "rejectAdmin", reason }),
    lockBankRate: (ref, rate, depositAccount) =>
      transition(ref, { action: "lockRate", rate, depositAccount }),
    confirmRialDeposit: (ref, receiptNo) =>
      transition(ref, { action: "confirmRialDeposit", receiptNo }),
    recordCryptoSent: (ref, txHash, bankWalletAddress) =>
      transition(ref, { action: "recordCryptoSent", txHash, bankWalletAddress }),
    rejectBank: (ref, reason) => transition(ref, { action: "rejectBank", reason }),

    byId: (ref) => get().list.find((i) => i.id === ref),
    byTrx: (trx) => get().list.find((i) => i.trxId === trx),
  };
});

onReload(SLICE, () => useSendStore.getState().load());
