import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, Page } from "playwright";

/**
 * Photographs the real panels, for the guides to show.
 *
 * The first guides were slides: paragraphs of Persian over a diagram, twelve
 * seconds each, nine minutes long. Somebody who has never seen the system
 * learns nothing from a description of a screen they have not been shown — so
 * these videos are built out of the screens themselves, and the words shrink to
 * a caption.
 *
 * Runs against a scratch database full of plausible trade (`demo-world.ts`), on
 * a dev server the operator starts first. Nothing here reads or writes the real
 * one.
 */
export type Shot = {
  /** File name, without extension, referenced from `content.ts`. */
  name: string;
  path: string;
  /** Signed in as. */
  as: "merchant" | "foreign" | "admin" | "bank";
  /**
   * A region to frame, as a fraction of the page. The panels are wide and a
   * caption about one card should not be printed over the whole screen — the
   * point of a screenshot is to show the thing being talked about.
   */
  clip?: { x: number; y: number; w: number; h: number };
  /**
   * Frame this element instead of a fraction of the page.
   *
   * A dialog is a small card in the middle of a dimmed screen: shown whole, the
   * thing being described is a fifth of the frame and the rest is grey.
   */
  clipTo?: string;
  /**
   * Type into the form before the shot.
   *
   * An empty form teaches the shape of a form. A filled one teaches what goes
   * in it, which is the only reason to show it at all.
   */
  fill?: [string, string][];
  /** Something to draw a ring around, as a CSS selector. */
  ring?: string;
  /** Scroll here first. */
  scrollTo?: string;
  /** Click these, in order, before the shot — to open a dialog or a tab. */
  click?: string[];
  wait?: number;
};

const BASE = process.env.GUIDE_BASE_URL ?? "http://localhost:3100";
const PEOPLE = {
  merchant: "aria@demo.afa",
  foreign: "anatolia@demo.afa",
  admin: "admin@demo.afa",
  bank: "bank@demo.afa",
} as const;

/** Signs in the way a person does, and keeps the cookie for the whole run. */
async function cookieFor(email: string) {
  const ask = async () => {
    const r = await fetch(`${BASE}/api/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return r.json();
  };
  let body = await ask();
  // The resend cooldown is real and worth keeping; a capture run simply waits.
  if (body?.error?.code === "too_many_requests") {
    const seconds = Number(/(\d+)/.exec(body.error.message ?? "")?.[1] ?? 30);
    await new Promise((r) => setTimeout(r, (seconds + 2) * 1000));
    body = await ask();
  }
  const code = body?.data?.devCode;
  if (!code) throw new Error(`no sign-in code for ${email}: ${JSON.stringify(body)}`);
  const v = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const set = v.headers.get("set-cookie");
  if (!set) throw new Error(`sign-in refused for ${email}`);
  return set.split(";")[0]!;
}

/**
 * The frame a guide is shot in.
 *
 * Wide enough that a table is not squeezed into a column, short enough that a
 * card fills the height rather than floating in it — the old guides left most
 * of the frame empty, which is most of why they felt slow.
 */
export const FRAME = { width: 1600, height: 1000 };

export async function capture(browser: Browser, shots: Shot[], outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const pages = new Map<string, Page>();

  for (const who of new Set(shots.map((s) => s.as))) {
    const cookie = await cookieFor(PEOPLE[who]);
    const ctx = await browser.newContext({
      viewport: FRAME,
      deviceScaleFactor: 2,
      locale: "fa-IR",
      colorScheme: "light",
    });
    await ctx.addCookies([
      {
        name: cookie.split("=")[0]!,
        value: cookie.split("=").slice(1).join("="),
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await ctx.newPage();
    // Animations mid-flight make a screenshot look like a rendering bug.
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-duration: 0s !important;
        animation-delay: 0s !important; transition-duration: 0s !important; }`,
    }).catch(() => {});
    pages.set(who, page);
  }

  const written: string[] = [];
  for (const shot of shots) {
    const page = pages.get(shot.as)!;
    await page.goto(BASE + shot.path, { waitUntil: "networkidle" }).catch(() => {});
    await page.addStyleTag({
      content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
    }).catch(() => {});
    await page.waitForTimeout(shot.wait ?? 1200);

    for (const sel of shot.click ?? []) {
      await page.locator(sel).first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    for (const [sel, value] of shot.fill ?? []) {
      await page.locator(sel).first().fill(value, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(120);
    }
    if (shot.fill?.length) {
      // Leave nothing focused: a blinking caret in one field reads as "this is
      // the step", which is a claim the caption may not be making.
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur()).catch(() => {});
      await page.waitForTimeout(250);
    }
    if (shot.scrollTo) {
      await page.locator(shot.scrollTo).first().scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (shot.ring) {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const ring = document.createElement("div");
        ring.style.cssText = `position:fixed;left:${r.left - 6}px;top:${r.top - 6}px;
          width:${r.width + 12}px;height:${r.height + 12}px;border:3px solid oklch(0.62 0.2 25);
          border-radius:12px;box-shadow:0 0 0 9999px rgba(15,23,42,.45);z-index:2147483647;
          pointer-events:none`;
        document.body.appendChild(ring);
      }, shot.ring).catch(() => {});
      await page.waitForTimeout(200);
    }

    let box: { x: number; y: number; width: number; height: number } | null = null;
    if (shot.clipTo) {
      const found = await page.locator(shot.clipTo).first().boundingBox().catch(() => null);
      if (found) {
        const pad = 28;
        box = {
          x: Math.max(0, found.x - pad),
          y: Math.max(0, found.y - pad),
          width: Math.min(FRAME.width, found.width + pad * 2),
          height: Math.min(FRAME.height, found.height + pad * 2),
        };
      }
    }

    const file = resolve(outDir, `${shot.name}.png`);
    await page.screenshot({
      path: file,
      clip: box ?? (shot.clip
        ? {
            x: shot.clip.x * FRAME.width,
            y: shot.clip.y * FRAME.height,
            width: shot.clip.w * FRAME.width,
            height: shot.clip.h * FRAME.height,
          }
        : undefined),
    });
    written.push(shot.name);
    process.stdout.write(`  · ${shot.name}\n`);
  }

  for (const page of pages.values()) await page.context().close();
  writeFileSync(resolve(outDir, "index.json"), JSON.stringify(written, null, 2) + "\n");
  return written;
}
