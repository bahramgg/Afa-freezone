"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuthStore } from "@/lib/stores/auth";

/**
 * Where the emailed link lands.
 *
 * It redeems on arrival and moves on, so the token spends the moment it is
 * used rather than sitting in the address bar. Nothing here asks the person to
 * confirm: they already confirmed by opening their own mail.
 */
function Verifying() {
  const router = useRouter();
  const params = useSearchParams();
  const verifyLink = useAuthStore((s) => s.verifyLink);
  const token = params.get("token");
  // A missing token is knowable at render; only the redemption is asynchronous.
  const [error, setError] = useState<string | null>(token ? null : "این پیوند ناقص است");
  // React runs effects twice in development; a single-use token would be spent
  // by the first pass and rejected on the second.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    verifyLink(token)
      .then((home) => router.replace(home))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "ورود ناموفق بود"));
  }, [token, router, verifyLink]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            {error ? (
              <>
                <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
                <p className="text-sm">{error}</p>
                <Button asChild className="w-full">
                  <Link href="/login">درخواست کد جدید</Link>
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">در حال ورود…</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * The token only exists on the client, so reading it has to happen behind a
 * boundary — without one the whole route refuses to prerender.
 */
export default function LoginVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <Verifying />
    </Suspense>
  );
}
