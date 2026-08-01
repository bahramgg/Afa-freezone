"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuthStore } from "@/lib/stores/auth";
import { toPersianDigits } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const result = await requestOtp(phone);
    setStep("otp");
    toast.success("کد تأیید ارسال شد", {
      // In development the SMS provider only logs, so the code is surfaced
      // here to keep the flow usable before an SMS panel is connected.
      description: result.devCode
        ? `کد توسعه: ${result.devCode}`
        : "کد به شماره موبایل شما ارسال شد",
    });
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("شماره موبایل را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      await sendCode();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارسال کد ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(phone, otp.join(""));
      // Read the session the server just established, not a stale render.
      const { hasProfile, hasPassedKyc } = useAuthStore.getState();
      if (!hasProfile) router.replace("/profile");
      else if (!hasPassedKyc) router.replace("/kyc-waiting");
      else router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تأیید کد ناموفق بود");
    } finally {
      setLoading(false);
    }
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
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  ادامه
                </Button>
              </form>



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
                  onClick={() => { void sendCode().catch((e) => toast.error(e instanceof Error ? e.message : "ارسال مجدد ناموفق بود")); }}
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
