"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedInvoices } from "../mock/fixtures";
import { nextGatewayAddress, nextTxHash } from "../mock/chain";
import { pushNotification } from "./notifications";
import type { Currency, Invoice, InvoiceStatus } from "../types";

type InvoicesState = {
  list: Invoice[];
  create: (input: {
    amount: number;
    currency: Currency;
    description: string;
    senderName: string;
    goodsTitle: string;
    walletAddress?: string;
  }) => Invoice;
  approve: (id: string) => void;
  reject: (id: string, reason?: string) => void;
  startPayment: (id: string) => void;
  markPaid: (id: string) => void;
  expire: (id: string) => void;
  setStatus: (id: string, status: InvoiceStatus) => void;
  byStatus: (s: InvoiceStatus | "ALL") => Invoice[];
  byId: (id: string) => Invoice | undefined;
  byTrx: (trx: string) => Invoice | undefined;
};

const SLICE = "invoices";

function nextIds(list: Invoice[]) {
  const invNums = list
    .map((i) => Number((i.id.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const trxNums = list
    .map((i) => Number((i.trxId?.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const invMax = invNums.length ? Math.max(...invNums) : 1042;
  const trxMax = trxNums.length ? Math.max(...trxNums) : 1042;
  return { id: `INV-${invMax + 1}`, trxId: `TRX-${trxMax + 1}` };
}

export const useInvoicesStore = create<InvoicesState>()(
  persist(
    (set, get) => ({
      list: seedInvoices(),
      create: ({ amount, currency, description, senderName, goodsTitle, walletAddress }) => {
        const now = new Date().toISOString();
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const { id, trxId } = nextIds(get().list);
        const inv: Invoice = {
          id,
          trxId,
          direction: "RECEIVE",
          amount,
          currency,
          description,
          senderName,
          goodsTitle,
          status: "PENDING",
          createdAt: now,
          updatedAt: now,
          paymentAddress: nextGatewayAddress(),
          walletAddress,
          userUid: "IR-001",
          userName: "علی رضایی",
          counterpartyName: senderName,
          expiresAt: expires,
        };
        set({ list: [inv, ...get().list] });
        broadcast(SLICE, { list: get().list });
        return inv;
      },
      approve: (id) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? { ...i, status: "APPROVED", updatedAt: new Date().toISOString() }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const inv = get().byId(id);
        if (inv) {
          pushNotification(
            "INVOICE_APPROVED",
            "فاکتور تأیید شد",
            `فاکتور ${id} توسط ادمین تأیید شد`,
            `/receive/${id}`,
          );
        }
      },
      reject: (id, reason) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "REJECTED",
                  rejectReason: reason,
                  description: i.description,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "INVOICE_REJECTED",
          "فاکتور رد شد",
          `فاکتور ${id} توسط ادمین رد شد`,
          `/receive`,
        );
      },
      startPayment: (id) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? { ...i, status: "PAYMENT_PENDING", updatedAt: new Date().toISOString() }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      markPaid: (id) => {
        const tx = nextTxHash();
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "PAID",
                  txHash: tx,
                  netAmount: i.amount * 0.98,
                  fee: i.amount * 0.02,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const inv = get().byId(id);
        if (inv) {
          pushNotification(
            "PAYMENT_RECEIVED",
            "پرداخت دریافت شد",
            `پرداخت برای فاکتور ${id} با موفقیت انجام شد`,
            `/receive/${id}`,
          );
        }
      },
      expire: (id) => {
        set({
          list: get().list.map((i) =>
            i.id === id ? { ...i, status: "EXPIRED" } : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "INVOICE_EXPIRED",
          "فاکتور منقضی شد",
          `فاکتور ${id} منقضی شد`,
          `/receive`,
        );
      },
      setStatus: (id, status) => {
        set({
          list: get().list.map((i) =>
            i.id === id ? { ...i, status, updatedAt: new Date().toISOString() } : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      byStatus: (s) => {
        const list = get().list;
        return s === "ALL" ? list : list.filter((i) => i.status === s);
      },
      byId: (id) => get().list.find((i) => i.id === id),
      byTrx: (trx) => get().list.find((i) => i.trxId === trx),
    }),
    { name: "afa-demo:invoices", version: 3 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    const p = payload as { list?: Invoice[] };
    if (p?.list) useInvoicesStore.setState({ list: p.list }, false);
  });
}
