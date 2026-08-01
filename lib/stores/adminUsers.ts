"use client";

import { create } from "zustand";
import { api, query } from "../api/client";
import { onReload } from "./_sync";
import type { AdminUserRecord } from "../types";

const SLICE = "adminUsers";

type AdminUsersState = {
  list: AdminUserRecord[];
  loading: boolean;
  loaded: boolean;
  load: (opts?: {
    role?: "ALL" | "IRANIAN" | "FOREIGN";
    kyc?: "ALL" | "PENDING" | "APPROVED" | "REJECTED";
    search?: string;
  }) => Promise<void>;
};

export const useAdminUsersStore = create<AdminUsersState>()((set) => ({
  list: [],
  loading: false,
  loaded: false,

  load: async (opts) => {
    set({ loading: true });
    try {
      const { list } = await api.get<{ list: AdminUserRecord[] }>(
        `/admin/users${query({ role: opts?.role, kyc: opts?.kyc, search: opts?.search })}`,
      );
      set({ list, loaded: true });
    } catch {
      set({ list: [], loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));

onReload(SLICE, () => useAdminUsersStore.getState().load());
