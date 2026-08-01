"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { PORTALS, type PortalKey } from "./portals";
import { useAuthStore } from "@/lib/stores/auth";
import { useBankStore } from "@/lib/stores/bank";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { cn } from "@/lib/cn";

export function PortalGrid() {
  const hydrated = useHydrated();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isForeignAuthed = useForeignStore((s) => s.isForeignAuthed);
  const foreignKyc = useForeignStore((s) => s.hasPassedKyc);
  const isBankAuthed = useBankStore((s) => s.isBankAuthed);

  const active: Record<PortalKey, boolean> = {
    user: hydrated && isAuthed && hasPassedKyc,
    foreign: hydrated && isForeignAuthed && foreignKyc,
    admin: hydrated && isAdmin,
    bank: hydrated && isBankAuthed,
  };

  return (
    <section id="portals" className="scroll-mt-20 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            از کدام درگاه وارد می‌شوید؟
          </h2>
          <p className="mt-3 text-pretty leading-8 text-muted-foreground">
            هر نقش پنل اختصاصی خودش را دارد. درگاه مربوط به خودتان را انتخاب کنید.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map((p) => {
            const Icon = p.icon;
            const isActive = active[p.key];
            return (
              <Link
                key={p.key}
                href={isActive ? p.dashboardHref : p.loginHref}
                className={cn(
                  "group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all",
                  "hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  p.accent.ring,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                      p.accent.iconBg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", p.accent.iconText)} />
                  </span>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-medium text-success">
                      <CircleCheck className="h-3 w-3" />
                      وارد شده
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-lg font-semibold leading-tight">{p.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground" dir="auto">
                  {p.subtitle}
                </p>

                <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                  {p.description}
                </p>

                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {p.bullets.map((b) => (
                    <li
                      key={b}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        p.accent.chip,
                      )}
                    >
                      {b}
                    </li>
                  ))}
                </ul>

                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {isActive ? "رفتن به داشبورد" : "ورود"}
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
