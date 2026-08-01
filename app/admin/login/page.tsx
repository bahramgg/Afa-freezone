"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const router = useRouter();
  const loginPassword = useAuthStore((s) => s.loginPassword);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginPassword(user, pass, "admin");
      toast.success("ورود ادمین موفق");
      router.replace("/admin/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-950 text-slate-100">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto w-fit rounded-full bg-primary/15 p-3">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">پنل ادمین</h1>
            <p className="text-xs text-slate-400 mt-1">دسترسی محدود به کارشناسان سازمان — ورود شما ثبت می‌شود</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border border-white/10 bg-slate-900 p-6">
          <div className="space-y-2">
            <Label htmlFor="user" className="text-slate-300">ایمیل</Label>
            <Input
              id="user"
              type="email"
              autoComplete="username"
              dir="ltr"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="bg-slate-800 border-white/10 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pass" className="text-slate-300">رمز عبور</Label>
            <Input
              id="pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="bg-slate-800 border-white/10 text-slate-100"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ورود به پنل ادمین
          </Button>
          <p className="text-[10px] text-slate-500 text-center">
            دسترسی غیرمجاز ثبت و پیگیری می‌شود
          </p>
        </form>
      </motion.div>
    </div>
  );
}
