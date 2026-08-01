"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { Currency, Invoice, InvoiceStatus } from "../types";

const SLICE = "invoices";

type InvoicesState = {
  list: Invoice[];
  loading: boolean;
  loaded: boolean;

  load: (opts?: { status?: InvoiceStatus | "ALL"; search?: string }) => Promise<void>;
  create: (input: {
    amount: number;
    currency: Currency;
    description: string;
    senderName: string;
    goodsTitle: string;
    walletAddress?: string;
  }) => Promise<Invoice>;
  approve: (ref: string) => Promise<void>;
  reject: (ref: string, reason: string) => Promise<void>;
  startPayment: (ref: string) => Promise<void>;
  /** Buyer reports the hash of the transfer they made; verified on chain. */
  confirmPayment: (ref: string, txHash: string) => Promise<void>;
  expire: (ref: string) => Promise<void>;

  byStatus: (s: InvoiceStatus | "ALL") => Invoice[];
  byId: (ref: string) => Invoice | undefined;
  byTrx: (trx: string) => Invoice | undefined;
};

/** Splices the server's copy of one invoice into the cached list. */
function replace(list: Invoice[], next: Invoice) {
  const i = list.findIndex((x) => x.id === next.id);
  if (i === -1) return [next, ...list];
  const copy = [...list];
  copy[i] = next;
  return copy;
}

export const useInvoicesStore = create<InvoicesState>()((set, get) => ({
  list: [],
  loading: false,
  loaded: false,

  load: async (opts) => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: Invoice[] }>(
        `/invoices${query({ status: opts?.status, search: opts?.search })}`,
      );
      set({ list, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  create: async (input) => {
    const { invoice } = await api.post<{ invoice: Invoice }>("/invoices", input);
    set({ list: [invoice, ...get().list] });
    pingReload(SLICE);
    return invoice;
  },

  approve: async (ref) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "approve",
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  reject: async (ref, reason) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "reject",
      reason,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  startPayment: async (ref) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "startPayment",
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  confirmPayment: async (ref, txHash) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "confirmPayment",
      txHash,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  expire: async (ref) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "expire",
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  byStatus: (s) => (s === "ALL" ? get().list : get().list.filter((i) => i.status === s)),
  byId: (ref) => get().list.find((i) => i.id === ref),
  byTrx: (trx) => get().list.find((i) => i.trxId === trx),
}));

onReload(SLICE, () => useInvoicesStore.getState().load());
