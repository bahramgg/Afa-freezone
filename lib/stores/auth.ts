"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { broadcast, subscribeBroadcast } from "./_broadcast";
import { seedUser } from "../mock/fixtures";
import type { User } from "../types";

type AuthState = {
  user: User | null;
  isAuthed: boolean;
  isAdmin: boolean;
  hasProfile: boolean;
  hasPassedKyc: boolean;
  loginPhone: (phone: string) => void;
  loginGoogle: () => void;
  loginAdmin: () => void;
  completeProfile: (patch: Partial<User>) => void;
  markKycApproved: () => void;
  updateProfile: (patch: Partial<User>) => void;
  logout: () => void;
  logoutAdmin: () => void;
};

const SLICE = "auth";

function deriveFlags(user: User | null): { hasProfile: boolean; hasPassedKyc: boolean } {
  if (!user) return { hasProfile: false, hasPassedKyc: false };
  return {
    hasProfile: !!(user.fullName && user.nationalId),
    hasPassedKyc: user.kyc === "APPROVED",
  };
}

type AuthSnapshot = Pick<
  AuthState,
  "user" | "isAuthed" | "isAdmin" | "hasProfile" | "hasPassedKyc"
>;

function snapshot(s: AuthState): AuthSnapshot {
  return {
    user: s.user,
    isAuthed: s.isAuthed,
    isAdmin: s.isAdmin,
    hasProfile: s.hasProfile,
    hasPassedKyc: s.hasPassedKyc,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthed: false,
      isAdmin: false,
      hasProfile: false,
      hasPassedKyc: false,
      loginPhone: (phone) => {
        const user = get().user ?? { ...seedUser(), phone };
        set({ isAuthed: true, user, ...deriveFlags(user) });
        broadcast(SLICE, snapshot(get()));
      },
      loginGoogle: () => {
        const user = get().user ?? seedUser();
        set({ isAuthed: true, user, ...deriveFlags(user) });
        broadcast(SLICE, snapshot(get()));
      },
      loginAdmin: () => {
        set({ isAdmin: true });
        broadcast(SLICE, snapshot(get()));
      },
      completeProfile: (patch) => {
        const base = get().user ?? seedUser();
        set({
          user: { ...base, ...patch },
          hasProfile: true,
        });
        broadcast(SLICE, snapshot(get()));
      },
      markKycApproved: () => {
        const u = get().user ?? seedUser();
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
        set({ isAuthed: false, hasProfile: false, hasPassedKyc: false });
        broadcast(SLICE, snapshot(get()));
      },
      logoutAdmin: () => {
        set({ isAdmin: false });
        broadcast(SLICE, snapshot(get()));
      },
    }),
    { name: "afa-demo:auth", version: 1 },
  ),
);

if (typeof window !== "undefined") {
  subscribeBroadcast(SLICE, (payload) => {
    if (!payload || typeof payload !== "object") return;
    useAuthStore.setState(payload as Partial<AuthState>, false);
  });
}
