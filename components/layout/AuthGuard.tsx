"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore, type PortalKey } from "@/lib/stores/auth";
import { useHydrated } from "@/lib/stores/hydration";
import { ROUTE_GUARDS_ENABLED } from "@/lib/guards";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Opens a panel to whoever arrives.
 *
 * While open access is on there is no sign-in anywhere: reaching a panel adopts
 * the account that panel belongs to and the rest of the system carries on as
 * usual, because what it gets is a real session. Roles, row scoping and
 * ownership are all still enforced on the server — the link decides who you
 * are, not what you may do.
 */
export function usePortalEntry(portal: PortalKey, alreadyIn: boolean) {
  const openAccess = useAuthStore((s) => s.openAccess);
  const ready = useAuthStore((s) => s.ready);
  const enterPortal = useAuthStore((s) => s.enterPortal);

  useEffect(() => {
    if (!ready || !openAccess || alreadyIn) return;
    void enterPortal(portal).catch(() => {});
  }, [ready, openAccess, alreadyIn, portal, enterPortal]);

  // Held closed until the session question is settled, then until an identity
  // has been adopted. Pages fetch their own data on mount, so rendering them
  // before either is known fires a burst of requests that can only 401 — and
  // paints an empty panel for the instant before the real data arrives.
  return !ready || (openAccess && !alreadyIn);
}

function Waiting() {
  return (
    <div className="p-8 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function UserAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const role = useAuthStore((s) => s.role);
  const hasProfile = useAuthStore((s) => s.hasProfile);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;
  const entering = usePortalEntry("user", isAuthed && role === "IRANIAN");

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAuthed) router.replace("/");
    else if (!hasProfile) router.replace("/profile");
    else if (!hasPassedKyc) router.replace("/kyc-waiting");
  }, [hydrated, isAuthed, hasProfile, hasPassedKyc, router]);

  if (ROUTE_GUARDS_ENABLED && (!hydrated || !isAuthed || !hasProfile || !hasPassedKyc)) {
    return <Waiting />;
  }
  if (entering) return <Waiting />;
  return <>{children}</>;
}

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;
  const entering = usePortalEntry("admin", isAdmin);

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAdmin) router.replace("/");
  }, [hydrated, isAdmin, router]);

  if (ROUTE_GUARDS_ENABLED && (!hydrated || !isAdmin)) return <Waiting />;
  if (entering) return <Waiting />;
  return <>{children}</>;
}
