"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuthStore } from "@/lib/stores/auth";
import { TIMINGS } from "@/lib/mock/timings";
import { toPersianDigits } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

type Step = "phone" | "otp";

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

export default function LoginPage() {
  const router = useRouter();
  const loginPhone = useAuthStore((s) => s.loginPhone);
  const loginGoogle = useAuthStore((s) => s.loginGoogle);
  const hasProfile = useAuthStore((s) => s.hasProfile);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  function continueAfterAuth() {
    if (!hasProfile) router.replace("/profile");
    else if (!hasPassedKyc) router.replace("/kyc-waiting");
    else router.replace("/dashboard");
  }

  function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("شماره موبایل را وارد کنید");
      return;
    }
    setStep("otp");
    toast.success("کد تأیید ارسال شد", {
      description: "کد به شماره موبایل شما ارسال شد",
    });
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, TIMINGS.OTP_VERIFY_MS));
    loginPhone(phone);
    setLoading(false);
    continueAfterAuth();
  }

  function handleOtpChange(idx: number, val: string) {
    const v = val.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[idx] = v;
    setOtp(next);
    if (v && idx < 5) {
      const el = document.getElementById(`otp-${idx + 1}`);
      el?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length) {
      const arr = text.split("");
      const next = [...otp];
      for (let i = 0; i < 6; i++) next[i] = arr[i] ?? "";
      setOtp(next);
      e.preventDefault();
    }
  }

  function googleLogin() {
    loginGoogle();
    router.replace("/profile");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero side */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/95 via-primary to-primary/80 p-10 text-primary-foreground">
        <div />
        <div className="space-y-4">
          <p className="text-primary-foreground/80 text-sm leading-7 max-w-md">
            پرداخت‌های بین‌المللی، تسویه آنی، و گزارش‌های کامل — همه در یک پنل ساده.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["USDT", "BNB", "BSC Network"].map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © ۱۴۰۵ سازمان منطقه آزاد گلستان — همه حقوق محفوظ است
        </p>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          {step === "phone" ? (
            <>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">ورود به پنل</h1>
                <p className="text-sm text-muted-foreground">شماره موبایل خود را وارد کنید</p>
              </div>

              <form onSubmit={submitPhone} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">شماره موبایل</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pe-10 text-base"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg">
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

              <p className="text-xs text-center text-muted-foreground">
                با ورود، شرایط استفاده را می‌پذیرید
              </p>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3 rotate-180" />
                  بازگشت
                </button>
                <h1 className="text-2xl font-semibold tracking-tight">کد تأیید</h1>
                <p className="text-sm text-muted-foreground">
                  کد ارسال‌شده به {toPersianDigits(phone)} را وارد کنید
                </p>
              </div>

              <form onSubmit={submitOtp} className="space-y-5">
                <div className="flex justify-between gap-2 ltr" dir="ltr">
                  {otp.map((d, i) => (
                    <Input
                      key={i}
                      id={`otp-${i}`}
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className={cn(
                        "h-12 w-12 text-center text-lg font-medium",
                        d && "border-primary",
                      )}
                    />
                  ))}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  تأیید و ادامه
                </Button>
                <button
                  type="button"
                  className="block w-full text-xs text-center text-muted-foreground hover:text-foreground"
                  onClick={() => toast.success("کد تأیید مجدداً ارسال شد")}
                >
                  ارسال مجدد کد
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
