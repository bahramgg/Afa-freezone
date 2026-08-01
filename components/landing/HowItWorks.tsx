"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, Banknote } from "lucide-react";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/format";

type Flow = {
  key: string;
  label: string;
  icon: typeof Banknote;
  summary: string;
  steps: { title: string; body: string; actor: string }[];
};

const FLOWS: Flow[] = [
  {
    key: "receive",
    label: "دریافت وجه",
    icon: ArrowDownToLine,
    summary: "بازرگان ایرانی فاکتور صادر می‌کند و خریدار خارجی آن را با کریپتو می‌پردازد.",
    steps: [
      {
        actor: "بازرگان ایرانی",
        title: "صدور فاکتور",
        body: "مبلغ، ارز، شرح کالا و نام خریدار ثبت می‌شود و یک شناسه تراکنش یکتا صادر می‌گردد.",
      },
      {
        actor: "ادمین سازمان",
        title: "بررسی و تأیید",
        body: "فاکتور از نظر انطباق با مقررات بررسی و تأیید یا با ذکر دلیل رد می‌شود.",
      },
      {
        actor: "خریدار خارجی",
        title: "پرداخت کریپتو",
        body: "آدرس اختصاصی درگاه به همراه QR نمایش داده می‌شود و پرداخت روی شبکه BSC انجام می‌گیرد.",
      },
      {
        actor: "سامانه",
        title: "تأیید روی زنجیره",
        body: "واریز به‌صورت خودکار رصد، تأییدیه‌ها شمارش و فاکتور پرداخت‌شده علامت‌گذاری می‌شود.",
      },
    ],
  },
  {
    key: "send",
    label: "ارسال وجه",
    icon: ArrowUpFromLine,
    summary: "بازرگان ایرانی ریال می‌پردازد و بانک عامل کریپتو را به طرف خارجی می‌فرستد.",
    steps: [
      {
        actor: "بازرگان ایرانی",
        title: "ثبت درخواست ارسال",
        body: "شناسه طرف خارجی، مبلغ و ارز مشخص می‌شود و درخواست برای طرف مقابل ارسال می‌گردد.",
      },
      {
        actor: "طرف خارجی",
        title: "اعلام آدرس والت",
        body: "گیرنده آدرس کیف پول مقصد خود را تأیید و ثبت می‌کند.",
      },
      {
        actor: "ادمین و بانک",
        title: "تأیید و قفل نرخ",
        body: "پس از تأیید سازمان، بانک نرخ ارز را قفل و شماره حساب واریز ریالی را اعلام می‌کند.",
      },
      {
        actor: "بانک عامل",
        title: "ارسال کریپتو",
        body: "با تأیید واریز ریال، کریپتو از کیف پول بانک به آدرس گیرنده منتقل و هش تراکنش ثبت می‌شود.",
      },
    ],
  },
  {
    key: "settlement",
    label: "تسویه ریالی",
    icon: Banknote,
    summary: "کریپتوی دریافت‌شده به بانک تحویل و معادل ریالی به حساب بازرگان واریز می‌شود.",
    steps: [
      {
        actor: "بازرگان ایرانی",
        title: "درخواست تسویه",
        body: "مبلغ، هش تراکنش مبدأ و شماره حساب مقصد برای تسویه ثبت می‌شود.",
      },
      {
        actor: "ادمین سازمان",
        title: "تطبیق و تأیید",
        body: "درخواست با سوابق تراکنش‌ها تطبیق داده و برای بانک ارسال می‌شود.",
      },
      {
        actor: "بانک عامل",
        title: "قفل نرخ و دریافت کریپتو",
        body: "بانک نرخ را قفل و آدرس کیف پول خود را اعلام می‌کند؛ سپس دریافت را روی زنجیره تأیید می‌نماید.",
      },
      {
        actor: "بانک عامل",
        title: "واریز ریالی",
        body: "معادل ریالی به حساب بازرگان واریز و شماره رسید در سامانه ثبت می‌شود.",
      },
    ],
  },
];

export function HowItWorks() {
  const [activeKey, setActiveKey] = useState(FLOWS[0].key);
  const active = FLOWS.find((f) => f.key === activeKey) ?? FLOWS[0];

  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">فرایند کار چگونه است؟</h2>
          <p className="mt-3 text-pretty leading-8 text-muted-foreground">
            سه جریان اصلی سامانه، هر کدام با نقش‌های مشخص و مراحل قابل پیگیری.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="جریان‌های کاری"
          className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-2 rounded-xl border border-border bg-card p-1.5 sm:flex-row"
        >
          {FLOWS.map((f) => {
            const Icon = f.icon;
            const selected = f.key === activeKey;
            return (
              <button
                key={f.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveKey(f.key)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {f.label}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm leading-8 text-muted-foreground">{active.summary}</p>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {active.steps.map((s, i) => (
            <motion.li
              key={`${active.key}-${s.title}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="relative flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {toPersianDigits(i + 1)}
              </span>
              <span className="mt-3 text-[11px] font-medium text-muted-foreground">{s.actor}</span>
              <h3 className="mt-0.5 font-semibold leading-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
