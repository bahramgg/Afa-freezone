"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedSendRequests, DEFAULT_USDT_RATE, DEFAULT_BNB_RATE } from "../mock/fixtures";
import { randomCounterpartyAddress, nextTxHash } from "../mock/chain";
import { pushNotification } from "./notifications";
import { pushForeignNotification } from "./foreign";
import { formatAmount } from "../format";
import type { Currency, SendRequest, SendStatus } from "../types";

type SendState = {
  list: SendRequest[];
  create: (input: {
    counterpartyUid: string;
    counterpartyName?: string;
    amount: number;
    currency: Currency;
    description?: string;
  }) => SendRequest;
  setStatus: (id: string, status: SendStatus) => void;
  approveCounterparty: (id: string, walletAddress: string) => void;
  approveAdmin: (id: string) => void;
  rejectAdmin: (id: string, reason: string) => void;
  lockBankRate: (id: string, rate: number, bankAccount: string) => void;
  confirmRialDeposit: (id: string, receiptNo: string) => void;
  sendCrypto: (id: string, bankWalletAddress: string) => void;
  markPaid: (id: string) => void;
  rejectBank: (id: string, reason: string) => void;
  byId: (id: string) => SendRequest | undefined;
  byTrx: (trx: string) => SendRequest | undefined;
};

const SLICE = "send";

function nextIds(list: SendRequest[]) {
  const sndNums = list
    .map((i) => Number((i.id.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const trxNums = list
    .map((i) => Number((i.trxId?.match(/(\d+)$/) || [])[1] || 0))
    .filter((n) => !Number.isNaN(n));
  const sndMax = sndNums.length ? Math.max(...sndNums) : 2008;
  const trxMax = trxNums.length ? Math.max(...trxNums) : 2008;
  return {
    id: `SND-${sndMax + 1}`,
    trxId: `TRX-${trxMax + 1}`,
  };
}

function defaultRate(currency: Currency) {
  return currency === "BNB" ? DEFAULT_BNB_RATE : DEFAULT_USDT_RATE;
}

export const useSendStore = create<SendState>()(
  persist(
    (set, get) => ({
      list: seedSendRequests(),
      create: ({ counterpartyUid, counterpartyName, amount, currency, description }) => {
        const now = new Date().toISOString();
        const { id, trxId } = nextIds(get().list);
        const rate = defaultRate(currency);
        const item: SendRequest = {
          id,
          trxId,
          userUid: "IR-001",
          userName: "علی رضایی",
          counterpartyUid,
          counterpartyName,
          amount,
          currency,
          description,
          status: "AWAITING_COUNTERPARTY",
          createdAt: now,
          updatedAt: now,
          exchangeRate: rate,
          rateLocked: false,
          rialAmount: amount * rate,
        };
        set({ list: [item, ...get().list] });
        broadcast(SLICE, { list: get().list });
        pushForeignNotification(
          "FOREIGN_RECEIVE_REQUEST",
          "درخواست دریافت جدید",
          `درخواست دریافت ${formatAmount(amount)} ${currency} از ${item.userName}`,
          "/foreign/requests",
        );
        return item;
      },
      setStatus: (id, status) => {
        const patch: Partial<SendRequest> = {
          status,
          updatedAt: new Date().toISOString(),
        };
        if (status === "PAYMENT_PENDING") {
          patch.paymentAddress = randomCounterpartyAddress();
        }
        set({
          list: get().list.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        });
        broadcast(SLICE, { list: get().list });
      },
      approveCounterparty: (id, walletAddress) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  recipientWalletAddress: walletAddress,
                  status: "AWAITING_ADMIN",
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      approveAdmin: (id) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "AWAITING_BANK_REVIEW",
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      rejectAdmin: (id, reason) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "REJECTED",
                  rejectedBy: "ADMIN",
                  rejectReason: reason,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      lockBankRate: (id, rate, bankAccount) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "BANK_RATE_LOCKED",
                  exchangeRate: rate,
                  rateLocked: true,
                  rialAmount: i.amount * rate,
                  bankAccount,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const item = get().byId(id);
        if (item) {
          pushNotification(
            "SEND_RATE_LOCKED",
            "نرخ ارز اعلام شد",
            `نرخ تراکنش ${item.trxId} توسط بانک قفل شد — منتظر واریز ریال شما`,
            "/send",
          );
        }
      },
      confirmRialDeposit: (id, receiptNo) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "RIAL_RECEIVED",
                  rialReceiptNo: receiptNo,
                  rialDepositAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      sendCrypto: (id, bankWalletAddress) => {
        const tx = nextTxHash();
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "CRYPTO_SENT",
                  bankWalletAddress,
                  txHashFromBank: tx,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const item = get().byId(id);
        if (item) {
          pushNotification(
            "SEND_COMPLETED",
            "کریپتو دریافت شد",
            `کریپتو از طرف بانک به والت شما واریز شد (${item.trxId})`,
            "/send",
          );
        }
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
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
        const item = get().byId(id);
        if (item) {
          pushNotification(
            "SEND_COMPLETED",
            "ارسال انجام شد",
            `ارسال ${formatAmount(item.amount)} ${item.currency} به ${item.counterpartyName ?? item.counterpartyUid} با موفقیت انجام شد`,
            `/send`,
          );
          pushForeignNotification(
            "FOREIGN_CRYPTO_RECEIVED",
            "کریپتو دریافت شد",
            `کریپتو ${formatAmount(item.amount)} ${item.currency} به والت شما واریز شد (${item.trxId})`,
            "/foreign/requests",
          );
        }
      },
      rejectBank: (id, reason) => {
        set({
          list: get().list.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "REJECTED",
                  rejectedBy: "BANK",
                  rejectReason: reason,
                  updatedAt: new Date().toISOString(),
                }
              : i,
          ),
        });
        broadcast(SLICE, { list: get().list });
      },
      byId: (id) => get().list.find((i) => i.id === id),
      byTrx: (trx) => get().list.find((i) => i.trxId === trx),
    }),
    { name: "afa-demo:send", version: 2 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    const p = payload as { list?: SendRequest[] };
    if (p?.list) useSendStore.setState({ list: p.list }, false);
  });
}
