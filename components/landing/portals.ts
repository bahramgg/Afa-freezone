import type { LucideIcon } from "lucide-react";
import { Building2, Crown, Globe2, UserRound } from "lucide-react";

export type PortalKey = "user" | "foreign" | "admin" | "bank";

export type Portal = {
  key: PortalKey;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  loginHref: string;
  dashboardHref: string;
  bullets: string[];
  /** Tailwind classes tying each portal to the accent of its own dashboard. */
  accent: {
    ring: string;
    iconBg: string;
    iconText: string;
    glow: string;
    chip: string;
  };
};

export const PORTALS: Portal[] = [
  {
    key: "user",
    title: "کاربر ایرانی",
    subtitle: "بازرگان داخلی",
    description:
      "صدور فاکتور ارزی، دریافت USDT از خریدار خارجی و تسویه ریالی از طریق بانک عامل.",
    icon: UserRound,
    loginHref: "/login",
    dashboardHref: "/dashboard",
    bullets: ["دریافت وجه", "ارسال وجه", "تسویه ریالی"],
    accent: {
      ring: "hover:border-primary/50",
      iconBg: "bg-primary/10",
      iconText: "text-primary",
      glow: "group-hover:shadow-[0_0_0_1px_var(--color-primary)]",
      chip: "bg-primary/10 text-primary",
    },
  },
  {
    key: "foreign",
    title: "بازرگان خارجی",
    subtitle: "Foreign Merchant",
    description:
      "پرداخت فاکتورهای صادره از ایران با کریپتو و دریافت وجه از طرف حساب ایرانی.",
    icon: Globe2,
    loginHref: "/foreign/login",
    dashboardHref: "/foreign/dashboard",
    bullets: ["پرداخت فاکتور", "درخواست دریافت", "مدیریت والت"],
    accent: {
      ring: "hover:border-info/50",
      iconBg: "bg-info/10",
      iconText: "text-info",
      glow: "group-hover:shadow-[0_0_0_1px_var(--color-info)]",
      chip: "bg-info/10 text-info",
    },
  },
  {
    key: "admin",
    title: "ادمین سازمان",
    subtitle: "منطقه آزاد گلستان",
    description:
      "احراز هویت کاربران، بررسی و تأیید فاکتورها، نظارت بر تراکنش‌ها و گزارش‌گیری.",
    icon: Crown,
    loginHref: "/admin/login",
    dashboardHref: "/admin/dashboard",
    bullets: ["احراز هویت", "تأیید تراکنش", "گزارشات"],
    accent: {
      ring: "hover:border-slate-500/50",
      iconBg: "bg-slate-500/10",
      iconText: "text-slate-600 dark:text-slate-300",
      glow: "group-hover:shadow-[0_0_0_1px_var(--color-muted-foreground)]",
      chip: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-200",
    },
  },
  {
    key: "bank",
    title: "بانک عامل",
    subtitle: "Settlement Bank",
    description:
      "اعلام و قفل نرخ ارز، دریافت و ارسال کریپتو از کیف پول بانک و تسویه ریالی نهایی.",
    icon: Building2,
    loginHref: "/bank/login",
    dashboardHref: "/bank/dashboard",
    bullets: ["قفل نرخ", "کیف پول بانک", "تسویه"],
    accent: {
      ring: "hover:border-success/50",
      iconBg: "bg-success/10",
      iconText: "text-success",
      glow: "group-hover:shadow-[0_0_0_1px_var(--color-success)]",
      chip: "bg-success/10 text-success",
    },
  },
];
