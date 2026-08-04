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
    counterpartyUid: string;
    goodsTitle: string;
    /** EXPORT unless the foreign seller is billing an Iranian importer. */
    direction?: "EXPORT" | "IMPORT";
    /** Import only: the seller's wallet, where the principal is paid. */
    beneficiaryWallet?: string;
    walletAddress?: string;
  }) => Promise<Invoice>;
  approve: (ref: string) => Promise<void>;
  reject: (ref: string, reason: string) => Promise<void>;
  /** Import only, bank: prices the invoice in rial and names the account. */
  lockRate: (ref: string, rate: number, depositAccount: string) => Promise<void>;
  /** Import only, bank: the importer's rial arrived. */
  confirmRialDeposit: (ref: string, receiptNo: string) => Promise<void>;
  /** Import only: either trader asks for the deal to be called off. */
  requestCancel: (ref: string, reason: string) => Promise<void>;
  /** Import only, organisation or bank: calls it off. */
  cancelImport: (ref: string, reason: string) => Promise<void>;
  /** Import only, bank: the importer's rial has gone back. */
  confirmRialReturn: (ref: string, receiptNo: string) => Promise<void>;
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

  lockRate: async (ref, rate, depositAccount) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "lockRate",
      rate,
      depositAccount,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  confirmRialDeposit: async (ref, receiptNo) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  requestCancel: async (ref, reason) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "requestCancel",
      reason,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  cancelImport: async (ref, reason) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "cancel",
      reason,
    });
    set({ list: replace(get().list, invoice) });
    pingReload(SLICE);
  },

  confirmRialReturn: async (ref, receiptNo) => {
    const { invoice } = await api.post<{ invoice: Invoice }>(`/invoices/${ref}/transition`, {
      action: "confirmRialReturn",
      receiptNo,
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
