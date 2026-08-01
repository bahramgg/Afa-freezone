"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBankStore } from "@/lib/stores/bank";
import { useHydrated } from "@/lib/stores/hydration";
import { Skeleton } from "@/components/ui/Skeleton";

export function BankAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = useBankStore((s) => s.isBankAuthed);
  const router = useRouter();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthed) router.replace("/bank/login");
  }, [hydrated, isAuthed, router]);

  if (!hydrated || !isAuthed) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
