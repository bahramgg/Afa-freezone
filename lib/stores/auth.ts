"use client";

import { create } from "zustand";
import { api } from "../api/client";
import { onReload, pingReload } from "./_sync";
import type { User } from "../types";

const SLICE = "auth";

export type PortalKey = "user" | "foreign" | "admin" | "bank";

type SessionPayload = {
  user: (User & { role?: string }) | null;
  hasProfile?: boolean;
  hasPassedKyc?: boolean;
  /** The panel this account belongs to, returned by a successful sign-in. */
  home?: string;
  /** Panels are open to anyone with the link; there is no sign-in. */
  openAccess?: boolean;
};

type AuthState = {
  user: User | null;
  role: string | null;
  isAuthed: boolean;
  isAdmin: boolean;
  isBank: boolean;
  hasProfile: boolean;
  hasPassedKyc: boolean;
  /** False until the first /me call resolves, so guards don't act early. */
  ready: boolean;
  /** Whether the deployment lets anyone with the link into a panel. */
  openAccess: boolean;

  load: () => Promise<void>;
  /** Adopts the account a panel belongs to. Only works while open access is on. */
  enterPortal: (portal: PortalKey) => Promise<void>;
  /** Emails a six-digit code and a one-click link. Works for every role. */
  requestOtp: (email: string) => Promise<{ expiresAt: string; devCode?: string; devLink?: string }>;
  /** Returns the panel this account belongs to, so the caller can land there. */
  verifyOtp: (email: string, code: string) => Promise<string>;
  /** The emailed link, redeemed. Same single-use record as the code. */
  verifyLink: (token: string) => Promise<string>;
  register: (input: {
    fullName: string;
    email: string;
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
  openAccess: false,

  load: async () => {
    try {
      const data = await api.get<SessionPayload>("/auth/me");
      set({ ...fromPayload(data), openAccess: data.openAccess ?? false, ready: true });
    } catch {
      // A failed lookup is indistinguishable from being signed out, and the
      // guards treat both the same way.
      set({ ...EMPTY, ready: true });
    }
  },

  enterPortal: async (portal) => {
    const data = await api.post<SessionPayload>("/auth/portal", { portal });
    set({ ...fromPayload(data), openAccess: true, ready: true });
    pingReload(SLICE);
  },

  requestOtp: (email) =>
    api.post<{ expiresAt: string; devCode?: string; devLink?: string }>("/auth/otp/request", {
      email,
    }),

  verifyOtp: async (email, code) => {
    const data = await api.post<SessionPayload>("/auth/otp/verify", { email, code });
    set({ ...fromPayload(data), ready: true });
    pingReload(SLICE);
    return data.home ?? "/dashboard";
  },

  verifyLink: async (token) => {
    const data = await api.post<SessionPayload>("/auth/otp/verify", { token });
    set({ ...fromPayload(data), ready: true });
    pingReload(SLICE);
    return data.home ?? "/dashboard";
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
