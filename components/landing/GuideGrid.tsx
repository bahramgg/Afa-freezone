"use client";

import { useState } from "react";
import { FileText, Play, X } from "lucide-react";
import { PORTALS } from "./portals";
import { cn } from "@/lib/cn";
import runtimes from "@/public/guide/runtimes.json";

/**
 * How the system works, for someone who does not use it.
 *
 * The panels above are for operators, who already know which one is theirs.
 * This is for everyone else — an official reviewing the system, an auditor, a
 * new colleague — who needs to understand what happens to the money before
 * they have any reason to sign in. Each entry is the same explanation twice:
 * one to watch, one to read and to file.
 *
 * The videos carry no soundtrack. Every word is on screen, which means they
 * work in a meeting room with the sound off and can be paused on any step.
 */
const RUNTIME = runtimes as Record<string, string>;

export function GuideGrid() {
  const [playing, setPlaying] = useState<string | null>(null);
  const open = PORTALS.find((p) => p.key === playing);

  return (
    <section id="guide" className="scroll-mt-24">
      <div className="grid gap-4 sm:grid-cols-2">
        {PORTALS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.key}
              className={cn(
                "flex flex-col rounded-lg border border-border bg-card p-5",
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
                  <h3 className="font-semibold leading-tight">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    نمودار مسیر، از شروع تا تسویه
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setPlaying(p.key)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium",
                    "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Play className="h-3.5 w-3.5" />
                  تماشای ویدئو
                  <span className="text-xs text-muted-foreground">{RUNTIME[p.key]}</span>
                </button>

                <a
                  href={`/guide/${p.key}.pdf`}
                  target="_blank"
                  rel="noopener"
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium",
                    "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  راهنمای متنی
                  <span className="text-xs text-muted-foreground">PDF</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`ویدئوی راهنمای ${open.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-lg bg-black shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 bg-card px-4 py-2.5">
              <span className="truncate text-sm font-medium">{open.title}</span>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                aria-label="بستن"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Controls stay on: these are meant to be paused and scrubbed
                back to a step, not sat through. The link is the fallback for a
                browser that will not play it inline — it still downloads. */}
            <video
              key={open.key}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="block max-h-[75vh] w-full bg-black"
            >
              <source src={`/guide/${open.key}.mp4`} type="video/mp4" />
              <a href={`/guide/${open.key}.mp4`}>دریافت ویدئو</a>
            </video>
          </div>
        </div>
      ) : null}
    </section>
  );
}
