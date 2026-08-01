"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedNotifications } from "../mock/fixtures";
import type { Notification, NotificationKind } from "../types";

type NotificationsState = {
  list: Notification[];
  push: (n: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
};

const SLICE = "notifications";

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      list: seedNotifications(),
      push: (n) => {
        const item: Notification = {
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
          read: n.read ?? false,
          ...n,
        };
        set({ list: [item, ...get().list] });
        broadcast(SLICE, { list: get().list });
      },
      markRead: (id) => {
        set({
          list: get().list.map((n) => (n.id === id ? { ...n, read: true } : n)),
        });
        broadcast(SLICE, { list: get().list });
      },
      markAllRead: () => {
        set({ list: get().list.map((n) => ({ ...n, read: true })) });
        broadcast(SLICE, { list: get().list });
      },
      unreadCount: () => get().list.filter((n) => !n.read).length,
    }),
    { name: "afa-demo:notifications", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    if (!payload || typeof payload !== "object") return;
    useNotificationsStore.setState(payload as Partial<NotificationsState>, false);
  });
}

export function pushNotification(
  kind: NotificationKind,
  title: string,
  body: string,
  href?: string,
) {
  useNotificationsStore.getState().push({ kind, title, body, href });
}
