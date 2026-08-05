import { resolve } from "node:path";
import { chromium } from "playwright";
import { capture } from "./capture";
import { SHOTS } from "./storyboard";

/**
 * Takes every screenshot the guides use.
 *
 *   npm run guides:shoot
 *
 * Needs a dev server pointed at the demo database — see scripts/media/README.
 */
async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  });
  try {
    const out = resolve(import.meta.dirname, "shots");
    const written = await capture(browser, SHOTS, out);
    console.log(`\n${written.length} shots → scripts/media/shots`);
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
