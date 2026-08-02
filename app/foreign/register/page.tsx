"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Logo } from "@/components/shared/Logo";
import { useForeignStore } from "@/lib/stores/foreign";

export default function ForeignRegisterPage() {
  const router = useRouter();
  const register = useForeignStore((s) => s.register);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    passportNo: "",
    country: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("رمز عبور باید حداقل ۸ کاراکتر باشد");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast.success("ثبت‌نام انجام شد — حساب شما در انتظار احراز هویت است");
      router.replace("/foreign/kyc-waiting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت‌نام ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="space-y-1.5 text-center">
          <Logo className="justify-center" />
          <h1 className="pt-3 text-2xl font-semibold tracking-tight">ثبت‌نام بازرگان خارجی</h1>
          <p className="text-sm text-muted-foreground">
            پس از ثبت‌نام، حساب شما توسط سازمان بررسی و تأیید می‌شود
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">نام و نام خانوادگی</Label>
            <Input id="fullName" value={form.fullName} onChange={set("fullName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              value={form.email}
              onChange={set("email")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              required
            />
            <p className="text-xs text-muted-foreground">حداقل ۸ کاراکتر</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passportNo">شماره پاسپورت</Label>
              <Input id="passportNo" dir="ltr" value={form.passportNo} onChange={set("passportNo")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">کشور</Label>
              <Input id="country" value={form.country} onChange={set("country")} />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ثبت‌نام
          </Button>
        </form>

      </motion.div>
    </div>
  );
}
