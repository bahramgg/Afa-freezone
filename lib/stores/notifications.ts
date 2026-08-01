"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { Notification } from "../types";

const SLICE = "notifications";

type NotificationsState = {
  list: Notification[];
  unread: number;
  loaded: boolean;

  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: () => number;
};

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  list: [],
  unread: 0,
  loaded: false,

  load: async () => {
    try {
      const data = await api.get<{ list: Notification[]; unread: number }>("/notifications");
      set({ list: data.list, unread: data.unread, loaded: true });
    } catch {
      // Signed-out visitors have no notifications; leaving the list empty is
      // the correct outcome, not an error worth surfacing.
      set({ list: [], unread: 0, loaded: true });
    }
  },

  markRead: async (id) => {
    // Optimistic: the badge should drop the moment the item is opened.
    set({
      list: get().list.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unread: Math.max(0, get().unread - 1),
    });
    await api.post("/notifications", { id });
    pingReload(SLICE);
  },

  markAllRead: async () => {
    set({ list: get().list.map((n) => ({ ...n, read: true })), unread: 0 });
    await api.post("/notifications", { all: true });
    pingReload(SLICE);
  },

  unreadCount: () => get().unread,
}));

onReload(SLICE, () => useNotificationsStore.getState().load());
