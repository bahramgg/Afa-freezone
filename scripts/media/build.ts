import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PANELS } from "./content";
import { runtimeOf } from "./storyboard";
import { renderVideo } from "./render-video";
import { renderPdf } from "./render-pdf";

/**
 * Builds the guides.
 *
 *   npm run guides            everything
 *   npm run guides -- bank    one panel
 *   npm run guides -- --pdf   documents only, which is quick
 *
 * The output lands in `public/guide/` and is committed, because it is what the
 * site serves. Regenerating is only necessary when the copy in `content.ts`
 * changes — which is to say, when the system it describes changes.
 */
const OUT = resolve(import.meta.dirname, "../../public/guide");

/** Persian digits, so the stamp on a cover page matches the rest of the page. */
const fa = (s: string | number) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

function jalaliToday() {
  const parts = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return `ویرایش ${parts}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const pdfOnly = argv.includes("--pdf");
  const videoOnly = argv.includes("--video");
  const filters = argv.filter((a) => !a.startsWith("-"));
  const panels = filters.length ? PANELS.filter((p) => filters.includes(p.key)) : PANELS;

  if (!panels.length) {
    console.log(`no panel matches ${filters.join(", ")} — try: ${PANELS.map((p) => p.key).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUT, { recursive: true });

  const ffmpeg = process.env.FFMPEG_PATH;
  if (!videoOnly && !pdfOnly && !ffmpeg) {
    console.log("! FFMPEG_PATH is not set — set it to an ffmpeg binary, or pass --pdf");
    process.exitCode = 1;
    return;
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  });

  const dateLabel = jalaliToday();
  const manifest: Record<string, { seconds: number; videoBytes: number; pdfBytes: number }> = {};

  try {
    for (const panel of panels) {
      console.log(`\n══ ${panel.title}`);

      let videoBytes = 0;
      if (!pdfOnly) {
        const started = Date.now();
        const video = await renderVideo(browser, panel, OUT, ffmpeg!);
        videoBytes = video.bytes;
        const mm = Math.floor(video.seconds / 60);
        const ss = String(video.seconds % 60).padStart(2, "0");
        console.log(
          `  ویدئو  ${mm}:${ss} · ${video.frames} فریم · ${(video.bytes / 1e6).toFixed(1)} MB` +
            ` · ${((Date.now() - started) / 1000).toFixed(0)}s`,
        );
      }

      let pdfBytes = 0;
      if (!videoOnly) {
        const pdf = await renderPdf(browser, panel, OUT, dateLabel);
        pdfBytes = pdf.bytes;
        console.log(`  سند     ${(pdf.bytes / 1024).toFixed(0)} KB`);
      }

      manifest[panel.key] = { seconds: runtimeOf(panel.key), videoBytes, pdfBytes };
    }
  } finally {
    await browser.close();
  }

  // What the landing page reads to label each card. Written from the same
  // content the guides were built from, so a runtime shown on the site cannot
  // drift from the file it describes.
  const runtimes = Object.fromEntries(
    PANELS.map((p) => {
      const s = runtimeOf(p.key);
      return [p.key, `${fa(Math.floor(s / 60))}:${fa(String(s % 60).padStart(2, "0"))}`];
    }),
  );
  writeFileSync(resolve(OUT, "runtimes.json"), JSON.stringify(runtimes, null, 2) + "\n");
  console.log(`\nنوشته شد در public/guide — ${Object.keys(manifest).length} پنل`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
