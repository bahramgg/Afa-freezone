"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedSettlements, DEFAULT_USDT_RATE, DEFAULT_BNB_RATE } from "../mock/fixtures";
import { pushNotification } from "./notifications";
import type { Currency, Settlement, SettlementStatus } from "../types";

type SettlementsState = {
  list: Settlement[];
  create: (
    input: Omit<
      Settlement,
      | "id"
      | "trxId"
      | "status"
      | "createdAt"
      | "updatedAt"
      | "exchangeRate"
      | "rateLocked"
      | "rialAmount"
    >,
  ) => Settlement;
  adminApprove: (id: string) => void;
  adminReject: (id: string, reason: string) => void;
  lockBankRate: (id: string, rate: number, bankWalletAddress: string) => void;
  submitUserTx: (id: string, txHash: string) => void;
  confirmCrypto: (id: string) => void;
  settle: (id: string, receiptNo: string) => void;
  bankReject: (id: string, reason: string) => void;
  bankApprove: (id: string, note?: string) => void;
  bankSettle: (id: string, note?: string) => void;
  byStatus: (s: SettlementStatus | "ALL") => Settlement[];
  byId: (id: string) => Settlement | undefined;
  byTrx: (trx: string) => Settlement | undefined;
};

const SLICE = "settlements";

function nextIds(list: Settlement[]) {
  const setNums = list
    .map((i) => Number((i.id.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const trxNums = list
    .map((i) => Number((i.trxId?.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const setMax = setNums.length ? Math.max(...setNums) : 1008;
  const trxMax = trxNums.length ? Math.max(...trxNums) : 3008;
  return {
    id: `SET-${setMax + 1}`,
    trxId: `TRX-${trxMax + 1}`,
  };
}

function defaultRate(currency: Currency) {
  return currency === "BNB" ? DEFAULT_BNB_RATE : DEFAULT_USDT_RATE;
}

export const useSettlementsStore = create<SettlementsState>()(
  persist(
    (set, get) => ({
      list: seedSettlements(),
      create: (input) => {
        const now = new Date().toISOString();
        const { id, trxId } = nextIds(get().list);
        const rate = defaultRate(input.currency);
        const item: Settlement = {
          ...input,
          id,
          trxId,
          status: "AWAITING_ADMIN",
          createdAt: now,
          updatedAt: now,
          exchangeRate: rate,
          rateLocked: false,
          rialAmount: input.amount * rate,
        };
        set({ list: [item, ...get().list] });
        broadcast(SLICE, { list: get().list });
        return item;
      },
      adminApprove: (id) => {
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "AWAITING_BANK",
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      adminReject: (id, reason) => {
        const now = new Date().toISOString();
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "REJECTED",
                  rejectedBy: "ADMIN",
                  rejectReason: reason,
                  bankResponseAt: now,
                  bankResponseNote: reason,
                  updatedAt: now,
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "SETTLEMENT_REJECTED",
          "درخواست تسویه رد شد",
          `درخواست ${id} توسط ادمین رد شد`,
          "/settlement",
        );
      },
      lockBankRate: (id, rate, bankWalletAddress) => {
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "BANK_RATE_LOCKED",
                  exchangeRate: rate,
                  rateLocked: true,
                  rialAmount: s.amount * rate,
                  bankWalletAddress,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const item = get().byId(id);
        if (item) {
          pushNotification(
            "SETTLEMENT_APPROVED",
            "آدرس والت بانک اعلام شد",
            `برای ${item.trxId} نرخ قفل شد — کریپتو را به آدرس اعلام‌شده ارسال کنید`,
            "/settlement",
          );
        }
      },
      submitUserTx: (id, txHash) => {
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "CRYPTO_RECEIVED",
                  userPayoutTxHash: txHash,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      confirmCrypto: (id) => {
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "CRYPTO_CONFIRMED",
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      settle: (id, receiptNo) => {
        const now = new Date().toISOString();
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "SETTLED",
                  rialReceiptNo: receiptNo,
                  rialDepositAt: now,
                  settledAt: now,
                  bankResponseAt: s.bankResponseAt ?? now,
                  bankResponseNote: s.bankResponseNote ?? "ریال به حساب کاربر واریز شد",
                  updatedAt: now,
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "SETTLEMENT_SETTLED",
          "تسویه انجام شد",
          `مبلغ درخواست ${id} به حساب شما واریز شد`,
          "/settlement",
        );
      },
      bankReject: (id, reason) => {
        const now = new Date().toISOString();
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "REJECTED",
                  rejectedBy: "BANK",
                  rejectReason: reason,
                  bankResponseAt: now,
                  bankResponseNote: reason,
                  updatedAt: now,
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "SETTLEMENT_REJECTED",
          "درخواست تسویه رد شد",
          `درخواست ${id} توسط بانک رد شد`,
          "/settlement",
        );
      },
      bankApprove: (id, note) => {
        const now = new Date().toISOString();
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "BANK_APPROVED",
                  bankResponseAt: now,
                  bankResponseNote: note ?? "تأیید شد، در حال انجام تسویه",
                  updatedAt: now,
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "SETTLEMENT_APPROVED",
          "درخواست تسویه تأیید شد",
          `درخواست ${id} توسط بانک تأیید شد`,
          "/settlement",
        );
      },
      bankSettle: (id, note) => {
        const now = new Date().toISOString();
        set({
          list: get().list.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "SETTLED",
                  settledAt: now,
                  bankResponseAt: s.bankResponseAt ?? now,
                  bankResponseNote: note ?? s.bankResponseNote ?? "تسویه با موفقیت انجام شد",
                  updatedAt: now,
                }
              : s,
          ),
        });
        broadcast(SLICE, { list: get().list });
        pushNotification(
          "SETTLEMENT_SETTLED",
          "تسویه انجام شد",
          `مبلغ درخواست ${id} به حساب شما واریز شد`,
          "/settlement",
        );
      },
      byStatus: (s) => {
        const list = get().list;
        return s === "ALL" ? list : list.filter((i) => i.status === s);
      },
      byId: (id) => get().list.find((s) => s.id === id),
      byTrx: (trx) => get().list.find((s) => s.trxId === trx),
    }),
    { name: "afa-demo:settlements", version: 2 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    const p = payload as { list?: Settlement[] };
    if (p?.list) useSettlementsStore.setState({ list: p.list }, false);
  });
}
