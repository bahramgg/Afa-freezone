"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuthStore } from "@/lib/stores/auth";
import { toPersianDigits } from "@/lib/format";

/**
 * One door for all four panels.
 *
 * Nobody chooses a panel here and nobody types a password. The address decides
 * which panel opens, because the account behind it already knows what it is —
 * asking the person to pick would only give them a way to pick wrong.
 */
export default function LoginPage() {
  const router = useRouter();
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { devCode } = await requestOtp(email.trim());
      setSent(true);
      if (devCode) {
        setCode(devCode);
        toast.info(`کد در محیط توسعه: ${devCode}`);
      } else {
        toast.success("کد ورود ارسال شد — ایمیل خود را ببینید");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارسال کد ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const home = await verifyOtp(email.trim(), code.trim());
      router.replace(home);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardContent className="space-y-5 py-6">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold">ورود به سامانه</h1>
              <p className="text-xs leading-6 text-muted-foreground">
                {sent
                  ? "کد ۶ رقمی ارسال‌شده را وارد کنید، یا روی پیوند داخل ایمیل بزنید"
                  : "نشانی ایمیل خود را وارد کنید؛ کد ورود و یک پیوند مستقیم برایتان ارسال می‌شود"}
              </p>
            </div>

            {!sent ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  ارسال کد ورود
                </Button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="code">کد ورود</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    className="text-center font-mono text-lg tracking-[0.4em]"
                    placeholder="۰۰۰۰۰۰"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-xs text-muted-foreground">
                    به {toPersianDigits(email)} ارسال شد
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  ورود
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSent(false);
                    setCode("");
                  }}
                >
                  تغییر نشانی ایمیل
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            بازگشت به صفحهٔ نخست
          </Link>
        </p>
      </div>
    </div>
  );
}
