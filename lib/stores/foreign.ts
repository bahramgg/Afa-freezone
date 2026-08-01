"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedForeignUser, seedForeignWallets, seedForeignNotifications } from "../mock/fixtures";
import type { ForeignUser, Notification, NotificationKind, Wallet } from "../types";

type ForeignState = {
  user: ForeignUser | null;
  isForeignAuthed: boolean;
  hasProfile: boolean;
  hasPassedKyc: boolean;
  wallets: Wallet[];
  notifications: Notification[];
  loginEmail: (email: string) => void;
  loginGoogle: () => void;
  completeProfile: (patch: Partial<ForeignUser>) => void;
  markKycApproved: () => void;
  updateProfile: (patch: Partial<ForeignUser>) => void;
  logout: () => void;
  addWallet: (input: { address: string; label?: string }) => void;
  removeWallet: (address: string) => void;
  pushNotification: (
    kind: NotificationKind,
    title: string,
    body: string,
    href?: string,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
};

const SLICE = "foreign";

type ForeignSnapshot = Pick<
  ForeignState,
  "user" | "isForeignAuthed" | "hasProfile" | "hasPassedKyc" | "wallets" | "notifications"
>;

const snapshot = (s: ForeignState): ForeignSnapshot => ({
  user: s.user,
  isForeignAuthed: s.isForeignAuthed,
  hasProfile: s.hasProfile,
  hasPassedKyc: s.hasPassedKyc,
  wallets: s.wallets,
  notifications: s.notifications,
});

export const useForeignStore = create<ForeignState>()(
  persist(
    (set, get) => ({
      user: null,
      isForeignAuthed: false,
      hasProfile: false,
      hasPassedKyc: false,
      wallets: seedForeignWallets(),
      notifications: seedForeignNotifications(),
      loginEmail: (email) => {
        const base = get().user ?? { ...seedForeignUser(), email };
        set({ isForeignAuthed: true, user: base });
        broadcast(SLICE, snapshot(get()));
      },
      loginGoogle: () => {
        set({
          isForeignAuthed: true,
          user: get().user ?? seedForeignUser(),
          hasProfile: false,
        });
        broadcast(SLICE, snapshot(get()));
      },
      completeProfile: (patch) => {
        const base = get().user ?? seedForeignUser();
        set({ user: { ...base, ...patch }, hasProfile: true });
        broadcast(SLICE, snapshot(get()));
      },
      markKycApproved: () => {
        const u = get().user ?? seedForeignUser();
        set({ user: { ...u, kyc: "APPROVED" }, hasPassedKyc: true });
        broadcast(SLICE, snapshot(get()));
      },
      updateProfile: (patch) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, ...patch } });
        broadcast(SLICE, snapshot(get()));
      },
      logout: () => {
        set({ isForeignAuthed: false, hasProfile: false, hasPassedKyc: false });
        broadcast(SLICE, snapshot(get()));
      },
      addWallet: ({ address, label }) => {
        const wallet: Wallet = {
          address,
          label: label ?? "والت جدید",
          network: "BSC",
          verified: true,
          verifiedAt: new Date().toISOString(),
        };
        set({ wallets: [...get().wallets, wallet] });
        broadcast(SLICE, snapshot(get()));
      },
      removeWallet: (address) => {
        set({ wallets: get().wallets.filter((w) => w.address !== address) });
        broadcast(SLICE, snapshot(get()));
      },
      pushNotification: (kind, title, body, href) => {
        const n: Notification = {
          id: `fn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind,
          title,
          body,
          href,
          createdAt: new Date().toISOString(),
          read: false,
        };
        set({ notifications: [n, ...get().notifications] });
        broadcast(SLICE, snapshot(get()));
      },
      markRead: (id) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        });
        broadcast(SLICE, snapshot(get()));
      },
      markAllRead: () => {
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
        });
        broadcast(SLICE, snapshot(get()));
      },
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: "afa-demo:foreign", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    if (!payload || typeof payload !== "object") return;
    useForeignStore.setState(payload as Partial<ForeignState>, false);
  });
}

export function pushForeignNotification(
  kind: NotificationKind,
  title: string,
  body: string,
  href?: string,
) {
  useForeignStore.getState().pushNotification(kind, title, body, href);
}
