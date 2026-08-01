"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth";
import { useHydrated } from "@/lib/stores/hydration";
import "@/lib/devtools/reset";

export default function Home() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasProfile = useAuthStore((s) => s.hasProfile);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthed) router.replace("/login");
    else if (!hasProfile) router.replace("/profile");
    else if (!hasPassedKyc) router.replace("/kyc-waiting");
    else router.replace("/dashboard");
  }, [hydrated, isAuthed, hasProfile, hasPassedKyc, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      در حال انتقال...
    </div>
  );
}
