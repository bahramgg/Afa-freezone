"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Logo } from "@/components/shared/Logo";
import { useForeignStore } from "@/lib/stores/foreign";
import { TIMINGS } from "@/lib/mock/timings";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.5 0 19.5-7.6 19.5-19.5 0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16 4.5 9.1 9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.4l-6.4-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9 39.1 16 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.3l6.4 5.4c-.5.4 6.8-5 6.8-14.7 0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function ForeignLoginPage() {
  const router = useRouter();
  const loginEmail = useForeignStore((s) => s.loginEmail);
  const loginGoogle = useForeignStore((s) => s.loginGoogle);
  const hasProfile = useForeignStore((s) => s.hasProfile);
  const hasPassedKyc = useForeignStore((s) => s.hasPassedKyc);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function continueAfterAuth() {
    if (!hasProfile) router.replace("/foreign/profile");
    else if (!hasPassedKyc) router.replace("/foreign/kyc-waiting");
    else router.replace("/foreign/dashboard");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, TIMINGS.OTP_VERIFY_MS));
    loginEmail(email);
    setLoading(false);
    continueAfterAuth();
  }

  function googleLogin() {
    loginGoogle();
    router.replace("/foreign/profile");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-info/95 via-info to-info/80 p-10 text-white">
        <Logo withText size={40} className="text-white [&_span]:text-white/80 [&_span_.text-primary]:text-white" />
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-snug">
            International Partner Portal
            <br />
            <span className="text-xl">پنل کاربر بین‌المللی</span>
          </h2>
          <p className="text-white/80 text-sm leading-7 max-w-md">
            Receive crypto from Iranian business partners safely and securely.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["USDT", "BNB", "BSC Network", "KYC Compliant"].map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/60">
          Golestan Free Zone Organization © ۱۴۰۵
        </p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">ورود به پنل بین‌المللی</h1>
            <p className="text-sm text-muted-foreground">با ایمیل یا گوگل وارد شوید</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pe-10 text-base"
                  dir="ltr"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ادامه
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">یا</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={googleLogin} size="lg">
            <GoogleIcon className="h-4 w-4" />
            ورود با گوگل
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
