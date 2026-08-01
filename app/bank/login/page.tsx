"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Logo } from "@/components/shared/Logo";
import { useAuthStore } from "@/lib/stores/auth";

export default function BankLoginPage() {
  const router = useRouter();
  const loginPassword = useAuthStore((s) => s.loginPassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginPassword(username, password, "bank");
      toast.success("خوش آمدید");
      router.replace("/bank/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-3">
          <Logo
            withText
            size={48}
            className="mx-auto [&_span]:text-white [&_span_.text-primary]:text-emerald-300"
          />
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-800 px-4 py-1.5 text-xs">
            <Building2 className="h-3 w-3" />
            پنل بانک عامل — منطقه آزاد گلستان
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-900/60 border border-white/10 p-8 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="text-xl font-semibold">ورود به پنل بانک</h1>
            <p className="text-xs text-emerald-300">دسترسی مخصوص پرسنل بانک عامل</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-emerald-200">ایمیل</Label>
              <Input
                id="username"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bank@example.com"
                className="bg-emerald-950 border-emerald-800 text-emerald-50"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-emerald-200">رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-10 bg-emerald-950 border-emerald-800 text-emerald-50"
                  dir="ltr"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ورود
            </Button>
          </form>
          <p className="text-[10px] text-center text-emerald-400">
            دسترسی غیرمجاز ثبت و پیگیری می‌شود
          </p>
        </div>
      </motion.div>
    </div>
  );
}
