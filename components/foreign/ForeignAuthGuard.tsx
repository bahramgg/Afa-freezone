"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { ROUTE_GUARDS_ENABLED } from "@/lib/guards";
import { Skeleton } from "@/components/ui/Skeleton";

export function ForeignAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = useForeignStore((s) => s.isForeignAuthed);
  const hasProfile = useForeignStore((s) => s.hasProfile);
  const hasPassedKyc = useForeignStore((s) => s.hasPassedKyc);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAuthed) router.replace("/foreign/login");
    else if (!hasProfile) router.replace("/foreign/profile");
    else if (!hasPassedKyc) router.replace("/foreign/kyc-waiting");
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
