"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const TRUST = [
  { icon: ShieldCheck, label: "تحت نظارت سازمان منطقه آزاد" },
  { icon: BadgeCheck, label: "احراز هویت کامل (KYC)" },
  { icon: Zap, label: "تسویه در کمتر از ۲۴ ساعت" },
];

/**
 * Placeholder figures — replace with real aggregates once the API is wired up.
 * `ltr` isolates digit-plus-symbol values so the sign stays on the right in RTL.
 */
const STATS = [
  { value: "۱٬۲۴۰+", label: "تراکنش موفق", ltr: true },
  { value: "۳۸۰+", label: "بازرگان فعال", ltr: true },
  { value: "۱۸ کشور", label: "طرف حساب خارجی", ltr: false },
  { value: "۹۹٫۹٪", label: "در دسترس بودن", ltr: true },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 start-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 -end-32 h-80 w-80 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute -bottom-24 -start-24 h-80 w-80 rounded-full bg-success/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(to right, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 55% at 50% 20%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 55% at 50% 20%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            سامانه رسمی پرداخت ارزی منطقه آزاد گلستان
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.2] lg:text-6xl lg:leading-[1.15]">
            پرداخت‌های بین‌المللی،
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-l from-primary via-primary to-info bg-clip-text text-transparent">
              شفاف و قابل ردیابی
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">
            زیرساخت دریافت و ارسال وجه ارزی برای بازرگانان منطقه آزاد — از صدور فاکتور و
            پرداخت با USDT روی شبکه BSC تا تسویه ریالی از طریق بانک عامل، همه در یک سامانه
            یکپارچه با نظارت کامل سازمان.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a href="#portals">
                ورود به درگاه‌ها
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#how">آشنایی با فرایند</a>
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-4 w-4 shrink-0 text-success" />
                {label}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Live-ish figures */}
        <motion.dl
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card/60 p-4 text-center backdrop-blur sm:p-5"
            >
              <dt
                dir={s.ltr ? "ltr" : undefined}
                className={cn("text-xl font-bold tracking-tight sm:text-2xl", s.ltr && "text-center")}
              >
                {s.value}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
