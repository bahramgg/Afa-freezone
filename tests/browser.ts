import type { Browser, BrowserContext, Page } from "playwright";
import { BASE } from "./harness";

/**
 * What the browser suites share.
 *
 * These open the real pages, because a route that answers 200 and a page a
 * person can use are different claims. A panel can serve perfectly and still be
 * unusable — a guard that bounces the wrong role, a table that pushes the page
 * sideways on a phone, a component that throws after hydration and leaves an
 * empty shell. None of that is visible from the API.
 */

/**
 * Chromium comes with the environment. Downloading another copy per run is
 * slow and, on a locked-down box, impossible — so point at the installed one.
 */
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

export async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({ executablePath: EXECUTABLE });
}

/** A phone, because that is where a layout breaks first. */
export const PHONE = { width: 390, height: 900 };
export const DESKTOP = { width: 1280, height: 900 };

export type Session = {
  page: Page;
  context: BrowserContext;
  /** Anything the page threw or logged as an error, in the order it happened. */
  errors: string[];
  close(): Promise<void>;
};

/**
 * Opens a page already signed in as whoever the cookie belongs to.
 *
 * Signing in through the form every time would be honest and unbearably slow;
 * `login.test.ts` does that once, properly, so everything else can carry the
 * cookie the same way a returning visitor's browser does.
 */
export async function openAs(
  browser: Browser,
  cookie: string | null,
  viewport = PHONE,
): Promise<Session> {
  const context = await browser.newContext({ viewport });
  if (cookie) {
    await context.addCookies([
      { name: "afa_session", value: cookie, domain: "localhost", path: "/" },
    ]);
  }
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 140));
  });
  return { page, context, errors, close: () => context.close() };
}

/** Where the page ended up, path only — a redirect is usually the answer. */
export const landedOn = (page: Page) => page.url().replace(BASE, "").split("?")[0];

/** How many pixels wider than the viewport the document is. Should be zero. */
export const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Settles the page.
 *
 * Every panel loads its data after mount, so `networkidle` alone still catches
 * a table mid-render. The extra beat is the difference between reading a
 * loading skeleton and reading the screen.
 */
export async function visit(page: Page, path: string, settleMs = 1200) {
  const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(settleMs);
  return response;
}
