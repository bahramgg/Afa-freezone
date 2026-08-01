"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import { useAuthStore } from "./auth";
import type { ForeignUser, Notification, Wallet } from "../types";

const SLICE = "foreign";

/**
 * The foreign persona no longer keeps a parallel identity. Sessions, wallets
 * and notifications all come from the same endpoints as every other role —
 * scoped server-side by the session — so this store is a thin adapter that
 * keeps the foreign pages' existing API while reading the shared source.
 */
type ForeignState = {
  user: ForeignUser | null;
  isForeignAuthed: boolean;
  hasProfile: boolean;
  hasPassedKyc: boolean;
  wallets: Wallet[];
  notifications: Notification[];
  ready: boolean;

  load: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    passportNo?: string;
    country?: string;
  }) => Promise<void>;
  updateProfile: (patch: Partial<ForeignUser>) => Promise<void>;
  logout: () => Promise<void>;

  addWallet: (input: { address: string; label?: string }) => Promise<void>;
  removeWallet: (id: string) => Promise<void>;

  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: () => number;
};

export const useForeignStore = create<ForeignState>()((set, get) => {
  /** Mirrors the shared auth slice into this store's foreign-shaped view. */
  function syncFromAuth() {
    const auth = useAuthStore.getState();
    const isForeign = auth.role === "FOREIGN";
    set({
      user: isForeign ? (auth.user as unknown as ForeignUser) : null,
      isForeignAuthed: isForeign,
      hasProfile: isForeign && auth.hasProfile,
      hasPassedKyc: isForeign && auth.hasPassedKyc,
      ready: auth.ready,
    });
    return isForeign;
  }

  return {
    user: null,
    isForeignAuthed: false,
    hasProfile: false,
    hasPassedKyc: false,
    wallets: [],
    notifications: [],
    ready: false,

    load: async () => {
      await useAuthStore.getState().load();
      if (!syncFromAuth()) {
        set({ wallets: [], notifications: [] });
        return;
      }
      const [wallets, notifications] = await Promise.all([
        api.get<{ list: Wallet[] }>("/wallets?scope=mine").catch(() => ({ list: [] })),
        api
          .get<{ list: Notification[] }>("/notifications")
          .catch(() => ({ list: [] as Notification[] })),
      ]);
      set({ wallets: wallets.list, notifications: notifications.list });
    },

    loginEmail: async (email, password) => {
      await useAuthStore.getState().loginPassword(email, password, "foreign");
      await get().load();
      pingReload(SLICE);
    },

    register: async (input) => {
      await useAuthStore.getState().register(input);
      await get().load();
      pingReload(SLICE);
    },

    updateProfile: async (patch) => {
      await useAuthStore.getState().updateProfile(patch);
      syncFromAuth();
      pingReload(SLICE);
    },

    logout: async () => {
      await useAuthStore.getState().logout();
      set({
        user: null,
        isForeignAuthed: false,
        hasProfile: false,
        hasPassedKyc: false,
        wallets: [],
        notifications: [],
      });
      pingReload(SLICE);
    },

    addWallet: async ({ address, label }) => {
      const { wallet } = await api.post<{ wallet: Wallet }>("/wallets", {
        address,
        label,
        scope: "mine",
      });
      set({ wallets: [...get().wallets, wallet] });
      pingReload(SLICE);
    },

    removeWallet: async (id) => {
      await api.delete(`/wallets/${id}`);
      set({ wallets: get().wallets.filter((w) => w.id !== id) });
      pingReload(SLICE);
    },

    markRead: async (id) => {
      set({
        notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      });
      await api.post("/notifications", { id });
    },

    markAllRead: async () => {
      set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
      await api.post("/notifications", { all: true });
    },

    unreadCount: () => get().notifications.filter((n) => !n.read).length,
  };
});

onReload(SLICE, () => useForeignStore.getState().load());
