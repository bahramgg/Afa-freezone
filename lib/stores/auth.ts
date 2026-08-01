"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { User } from "../types";

const SLICE = "auth";

type SessionPayload = {
  user: (User & { role?: string }) | null;
  hasProfile?: boolean;
  hasPassedKyc?: boolean;
};

type AuthState = {
  user: User | null;
  role: string | null;
  isAuthed: boolean;
  isAdmin: boolean;
  isBank: boolean;
  hasProfile: boolean;
  hasPassedKyc: boolean;
  /** False until the first /me call resolves, so guards don't redirect early. */
  ready: boolean;

  load: () => Promise<void>;
  requestOtp: (email: string) => Promise<{ expiresAt: string; devCode?: string }>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  loginPassword: (
    email: string,
    password: string,
    portal: "foreign" | "admin" | "bank",
  ) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    passportNo?: string;
    country?: string;
    phone?: string;
  }) => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
};

const EMPTY = {
  user: null,
  role: null,
  isAuthed: false,
  isAdmin: false,
  isBank: false,
  hasProfile: false,
  hasPassedKyc: false,
} as const;

function fromPayload(payload: SessionPayload) {
  const role = payload.user?.role ?? null;
  return {
    user: payload.user,
    role,
    isAuthed: !!payload.user,
    isAdmin: role === "ADMIN",
    isBank: role === "BANK",
    hasProfile: payload.hasProfile ?? false,
    hasPassedKyc: payload.hasPassedKyc ?? false,
  };
}

export const useAuthStore = create<AuthState>()((set) => ({
  ...EMPTY,
  ready: false,

  load: async () => {
    try {
      const data = await api.get<SessionPayload>("/auth/me");
      set({ ...fromPayload(data), ready: true });
    } catch {
      // A failed lookup is indistinguishable from being signed out, and the
      // guards treat both the same way.
      set({ ...EMPTY, ready: true });
    }
  },

  requestOtp: (email) =>
    api.post<{ expiresAt: string; devCode?: string }>("/auth/otp/request", { email }),

  verifyOtp: async (email, code) => {
    const data = await api.post<SessionPayload>("/auth/otp/verify", { email, code });
    set({ ...fromPayload(data), ready: true });
    pingReload(SLICE);
  },

  loginPassword: async (email, password, portal) => {
    const data = await api.post<SessionPayload>("/auth/login", { email, password, portal });
    set({ ...fromPayload(data), ready: true });
    pingReload(SLICE);
  },

  register: async (input) => {
    const data = await api.post<SessionPayload>("/auth/register", input);
    set({ ...fromPayload(data), ready: true });
    pingReload(SLICE);
  },

  updateProfile: async (patch) => {
    const data = await api.patch<SessionPayload>("/profile", patch);
    set(fromPayload(data));
    pingReload(SLICE);
  },

  logout: async () => {
    await api.post("/auth/logout");
    set({ ...EMPTY, ready: true });
    pingReload(SLICE);
  },
}));

onReload(SLICE, () => useAuthStore.getState().load());
