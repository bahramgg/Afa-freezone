"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { PORTALS, type PortalKey } from "./portals";
import { useAuthStore } from "@/lib/stores/auth";
import { useForeignStore } from "@/lib/stores/foreign";
import { cn } from "@/lib/cn";

/**
 * The point of this page: a directory of the four panels. An operator arrives
 * knowing which one is theirs, so the card states who it is for and what it is
 * used for — nothing else.
 */
export function PortalGrid() {
  const ready = useAuthStore((s) => s.ready);
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasPassedKyc = useAuthStore((s) => s.hasPassedKyc);
  const role = useAuthStore((s) => s.role);
  const isForeignAuthed = useForeignStore((s) => s.isForeignAuthed);
  const foreignKyc = useForeignStore((s) => s.hasPassedKyc);

  const active: Record<PortalKey, boolean> = {
    user: ready && isAuthed && role === "IRANIAN" && hasPassedKyc,
    foreign: ready && isForeignAuthed && foreignKyc,
    admin: ready && role === "ADMIN",
    bank: ready && role === "BANK",
  };

  return (
    <section id="portals" className="scroll-mt-24">
      <div className="grid gap-4 sm:grid-cols-2">
        {PORTALS.map((p) => {
          const Icon = p.icon;
          const isActive = active[p.key];
          return (
            <Link
              key={p.key}
              href={isActive ? p.dashboardHref : p.loginHref}
              className={cn(
                "group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                p.accent.border,
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    p.accent.iconBg,
                  )}
                >
                  <Icon className={cn("h-5 w-5", p.accent.iconText)} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{p.title}</h3>
                    {isActive ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        <CircleCheck className="h-3 w-3" />
                        نشست فعال
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.audience}</p>
                </div>
              </div>

              <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{p.summary}</p>

              <span className="mt-4 inline-flex items-center gap-1.5 border-t border-border pt-3 text-sm font-medium">
                {isActive ? "ورود به پنل" : "ورود"}
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
