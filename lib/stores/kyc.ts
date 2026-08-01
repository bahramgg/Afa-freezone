"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

export type KycRequest = {
  uid: string;
  fullName: string;
  nationalId: string;
  phone: string;
  freezoneId: string;
  address: string;
  status: KycStatus;
  submittedAt: string;
  reviewedAt?: string;
  rejectNote?: string;
};

type KycState = {
  requests: KycRequest[];
  submitRequest: (data: Omit<KycRequest, "status" | "submittedAt">) => void;
  approveRequest: (uid: string) => void;
  rejectRequest: (uid: string, note?: string) => void;
  getRequestByUid: (uid: string) => KycRequest | undefined;
};

const SLICE = "kyc";

type KycSnapshot = Pick<KycState, "requests">;

function snapshot(s: KycState): KycSnapshot {
  return { requests: s.requests };
}

export const useKycStore = create<KycState>()(
  persist(
    (set, get) => ({
      requests: [],
      submitRequest: (data) => {
        const existing = get().requests.find((r) => r.uid === data.uid);
        if (existing) {
          set({
            requests: get().requests.map((r) =>
              r.uid === data.uid
                ? { ...r, ...data, status: "PENDING", submittedAt: new Date().toISOString(), reviewedAt: undefined, rejectNote: undefined }
                : r
            ),
          });
        } else {
          set({
            requests: [
              ...get().requests,
              { ...data, status: "PENDING", submittedAt: new Date().toISOString() },
            ],
          });
        }
        broadcast(SLICE, snapshot(get()));
      },
      approveRequest: (uid) => {
        set({
          requests: get().requests.map((r) =>
            r.uid === uid
              ? { ...r, status: "APPROVED", reviewedAt: new Date().toISOString() }
              : r
          ),
        });
        broadcast(SLICE, snapshot(get()));
      },
      rejectRequest: (uid, note) => {
        set({
          requests: get().requests.map((r) =>
            r.uid === uid
              ? { ...r, status: "REJECTED", reviewedAt: new Date().toISOString(), rejectNote: note }
              : r
          ),
        });
        broadcast(SLICE, snapshot(get()));
      },
      getRequestByUid: (uid) => get().requests.find((r) => r.uid === uid),
    }),
    { name: "afa-demo:kyc", version: 1 }
  )
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    if (!payload || typeof payload !== "object") return;
    useKycStore.setState(payload as Partial<KycState>, false);
  });
}
