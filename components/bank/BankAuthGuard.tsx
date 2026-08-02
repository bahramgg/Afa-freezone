"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { usePortalEntry } from "@/components/layout/AuthGuard";
import { useHydrated } from "@/lib/stores/hydration";
import { ROUTE_GUARDS_ENABLED } from "@/lib/guards";
import { Skeleton } from "@/components/ui/Skeleton";

export function BankAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isBank);
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const hydrated = useHydrated() && ready;
  const entering = usePortalEntry("bank", isAuthed);

  useEffect(() => {
    if (!ROUTE_GUARDS_ENABLED || !hydrated) return;
    if (!isAuthed) router.replace("/");
  }, [hydrated, isAuthed, router]);

  if ((ROUTE_GUARDS_ENABLED && (!hydrated || !isAuthed)) || entering) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
