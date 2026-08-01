"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth";
import { useBankStore } from "@/lib/stores/bank";
import { useForeignStore } from "@/lib/stores/foreign";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useKycStore } from "@/lib/stores/kyc";
import { useNotificationsStore } from "@/lib/stores/notifications";
import { useSendStore } from "@/lib/stores/send";
import { useSettingsStore } from "@/lib/stores/settings";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useTxStore } from "@/lib/stores/transactions";
import { useWalletsStore } from "@/lib/stores/wallets";
import { useAdminUsersStore } from "@/lib/stores/adminUsers";

type Scope = "user" | "foreign" | "admin" | "bank";

const SCOPE_ROLE: Record<Scope, string> = {
  user: "IRANIAN",
  foreign: "FOREIGN",
  admin: "ADMIN",
  bank: "BANK",
};

/**
 * Thunks, not calls — building this map must not fetch. An eagerly-evaluated
 * object would run every scope's loads on every mount, including the ones the
 * current role has no right to.
 */
const LOADERS: Record<Scope, (() => Promise<unknown>)[]> = {
  user: [
    () => useInvoicesStore.getState().load(),
    () => useSendStore.getState().load(),
    () => useSettlementsStore.getState().load(),
    () => useWalletsStore.getState().load(),
    () => useTxStore.getState().load(),
  ],
  foreign: [
    () => useForeignStore.getState().load(),
    () => useSendStore.getState().load(),
  ],
  admin: [
    () => useInvoicesStore.getState().load(),
    () => useSendStore.getState().load(),
    () => useSettlementsStore.getState().load(),
    () => useTxStore.getState().load(),
    () => useKycStore.getState().load("ALL"),
    () => useAdminUsersStore.getState().load(),
  ],
  bank: [
    () => useSendStore.getState().load(),
    () => useSettlementsStore.getState().load(),
    () => useBankStore.getState().load(),
    () => useTxStore.getState().load(),
  ],
};

const COMMON: (() => Promise<unknown>)[] = [
  () => useSettingsStore.getState().load(),
  () => useNotificationsStore.getState().load(),
];

/**
 * Loads the slices a persona's pages read, once per layout mount, instead of
 * having every page fetch for itself. Stores start empty now that the data
 * lives on the server, so without this a dashboard would render blank.
 *
 * Failures are swallowed: an unauthenticated or transient load leaves the store
 * empty, which the guards and empty states already handle.
 */
export function DataBootstrap({ scope }: { scope: Scope }) {
  const ready = useAuthStore((s) => s.ready);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    // Wait for the session, and only fetch what this role is entitled to.
    // Firing admin-scoped loads while a bank operator is being redirected away
    // would just produce a burst of 403s.
    if (!ready || role !== SCOPE_ROLE[scope]) return;

    const ignore = () => {};
    for (const load of [...COMMON, ...LOADERS[scope]]) {
      void load().then(ignore, ignore);
    }
  }, [scope, ready, role]);

  return null;
}

/**
 * Resolves the session before anything renders behind a guard. Split out from
 * DataBootstrap because the guards need it even on the bare login screens.
 */
export function SessionBootstrap() {
  const load = useAuthStore((s) => s.load);
  const ready = useAuthStore((s) => s.ready);

  useEffect(() => {
    if (!ready) void load().catch(() => {});
  }, [ready, load]);

  return null;
}
