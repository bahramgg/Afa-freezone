"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload, pingReload } from "./_sync";

const SLICE = "kyc";

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

export type KycRequest = {
  uid: string;
  fullName: string;
  role?: string;
  nationalId?: string;
  passportNo?: string;
  country?: string;
  phone?: string;
  email?: string;
  freezoneId?: string;
  address?: string;
  kyc: KycStatus;
  kycRejectReason?: string;
  submittedAt: string;
};

type KycState = {
  requests: KycRequest[];
  loading: boolean;
  loaded: boolean;

  load: (status?: KycStatus | "ALL") => Promise<void>;
  approveRequest: (uid: string) => Promise<void>;
  rejectRequest: (uid: string, reason: string) => Promise<void>;
  getRequestByUid: (uid: string) => KycRequest | undefined;
};

export const useKycStore = create<KycState>()((set, get) => ({
  requests: [],
  loading: false,
  loaded: false,

  load: async (status = "PENDING") => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: KycRequest[] }>(
        `/admin/kyc${query({ status })}`,
      );
      set({ requests: list, loaded: true });
    } catch {
      set({ requests: [], loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  approveRequest: async (uid) => {
    await api.post(`/admin/kyc/${uid}`, { action: "approve" });
    set({
      requests: get().requests.map((r) => (r.uid === uid ? { ...r, kyc: "APPROVED" } : r)),
    });
    pingReload(SLICE);
  },

  rejectRequest: async (uid, reason) => {
    await api.post(`/admin/kyc/${uid}`, { action: "reject", reason });
    set({
      requests: get().requests.map((r) =>
        r.uid === uid ? { ...r, kyc: "REJECTED", kycRejectReason: reason } : r,
      ),
    });
    pingReload(SLICE);
  },

  getRequestByUid: (uid) => get().requests.find((r) => r.uid === uid),
}));

onReload(SLICE, () => useKycStore.getState().load());
