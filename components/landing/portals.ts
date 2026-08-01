import type { LucideIcon } from "lucide-react";
import { Building2, Crown, Globe2, UserRound } from "lucide-react";

export type PortalKey = "user" | "foreign" | "admin" | "bank";

export type Portal = {
  key: PortalKey;
  title: string;
  /** Who signs in here — the page is a directory, not a pitch. */
  audience: string;
  /** What this panel is used for, stated plainly. */
  summary: string;
  icon: LucideIcon;
  loginHref: string;
  dashboardHref: string;
  /** Accent tying each entry to the panel it opens. */
  accent: {
    border: string;
    iconBg: string;
    iconText: string;
  };
};

export const PORTALS: Portal[] = [
  {
    key: "user",
    title: "بازرگان داخلی",
    audience: "اشخاص حقیقی و حقوقی ثبت‌شده در منطقه آزاد",
    summary: "صدور فاکتور ارزی، ثبت درخواست ارسال وجه و درخواست تسویه ریالی.",
    icon: UserRound,
    loginHref: "/login",
    dashboardHref: "/dashboard",
    accent: {
      border: "hover:border-primary/60",
      iconBg: "bg-primary/10",
      iconText: "text-primary",
    },
  },
  {
    key: "foreign",
    title: "بازرگان خارجی",
    audience: "طرف حساب‌های بین‌المللی",
    summary: "پرداخت فاکتورهای صادره و تأیید درخواست‌های دریافت وجه.",
    icon: Globe2,
    loginHref: "/foreign/login",
    dashboardHref: "/foreign/dashboard",
    accent: {
      border: "hover:border-info/60",
      iconBg: "bg-info/10",
      iconText: "text-info",
    },
  },
  {
    key: "admin",
    title: "کارشناس سازمان",
    audience: "کارکنان سازمان منطقه آزاد",
    summary: "بررسی احراز هویت، تأیید تراکنش‌ها، نظارت و گزارش‌گیری.",
    icon: Crown,
    loginHref: "/admin/login",
    dashboardHref: "/admin/dashboard",
    accent: {
      border: "hover:border-slate-500/60",
      iconBg: "bg-slate-500/10",
      iconText: "text-slate-600 dark:text-slate-300",
    },
  },
  {
    key: "bank",
    title: "بانک عامل",
    audience: "کارکنان واحد ارزی بانک",
    summary: "اعلام و قفل نرخ، مدیریت کیف پول‌ها و ثبت تسویه ریالی.",
    icon: Building2,
    loginHref: "/bank/login",
    dashboardHref: "/bank/dashboard",
    accent: {
      border: "hover:border-success/60",
      iconBg: "bg-success/10",
      iconText: "text-success",
    },
  },
];
