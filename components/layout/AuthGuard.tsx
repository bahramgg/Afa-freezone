"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth";
import { useHydrated } from "@/lib/stores/hydration";
import { ROUTE_GUARDS_ENABLED } from "@/lib/guards";
import { Skeleton } from "@/components/ui/Skeleton";

export function UserAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasProfile = useAuthStore((s) => s.hasProfile);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAuthed) router.replace("/login");
    else if (!hasProfile) router.replace("/profile");
    else if (!hasPassedKyc) router.replace("/kyc-waiting");
  }, [hydrated, isAuthed, hasProfile, hasPassedKyc, router]);

  if (ROUTE_GUARDS_ENABLED && (!hydrated || !isAuthed || !hasProfile || !hasPassedKyc)) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAdmin) router.replace("/admin/login");
  }, [hydrated, isAdmin, router]);

  if (ROUTE_GUARDS_ENABLED && (!hydrated || !isAdmin)) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
