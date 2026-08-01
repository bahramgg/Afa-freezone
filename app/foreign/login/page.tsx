"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Logo } from "@/components/shared/Logo";
import { useForeignStore } from "@/lib/stores/foreign";
import { toast } from "sonner";

export default function ForeignLoginPage() {
  const router = useRouter();
  const loginEmail = useForeignStore((s) => s.loginEmail);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginEmail(email, password);
      // Read the freshly-loaded session rather than a stale render's copy.
      const { hasProfile, hasPassedKyc } = useForeignStore.getState();
      if (!hasProfile) router.replace("/foreign/profile");
      else if (!hasPassedKyc) router.replace("/foreign/kyc-waiting");
      else router.replace("/foreign/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود ناموفق بود");
    } finally {
      setLoading(false);
    }
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
            <p className="text-sm text-muted-foreground">با ایمیل و رمز عبور خود وارد شوید</p>
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
            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base"
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ورود
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

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/foreign/register">ثبت‌نام بازرگان جدید</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
