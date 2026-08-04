import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { Browser } from "playwright";
import { beatSeconds, runtimeOf, type Panel } from "./content";
import { beatPayload, videoShell } from "./stage";

/**
 * Turns a panel's beats into an MP4.
 *
 * There is no soundtrack, so every word has to be on screen and every screen
 * has to stay long enough to be read. That shape — long holds, short moves —
 * is what decides how this is rendered: shooting every frame of a six-minute
 * film would be thousands of identical pictures, so only the moving part is
 * shot and the still part is held by the encoder instead.
 */
const FPS = 25;
/** How long a beat takes to arrive. Long enough to notice, short enough to skip. */
const ENTRANCE_SECONDS = 0.52;

export type VideoResult = { file: string; seconds: number; frames: number; bytes: number };

export async function renderVideo(
  browser: Browser,
  panel: Panel,
  outDir: string,
  ffmpeg: string,
): Promise<VideoResult> {
  const total = runtimeOf(panel);
  const work = resolve(outDir, `.frames-${panel.key}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(videoShell(panel, total), { waitUntil: "load" });
  // The fonts are inlined, but the browser still has to decode them before the
  // first paint. Without this the opening frames render in a fallback face that
  // does not join Persian letters.
  await page.evaluate(() => document.fonts.ready);

  /** Every still to be shown, with how long it stays up. */
  const shots: { file: string; seconds: number }[] = [];
  let index = 0;
  let elapsed = 0;
  const numbered = panel.beats.filter((b) => b.kind !== "cover").length;

  for (const beat of panel.beats) {
    const seconds = beatSeconds(beat);
    const payload = beatPayload(beat);
    if (beat.kind !== "cover") index++;

    const moving = Math.round(ENTRANCE_SECONDS * FPS);
    for (let f = 0; f < moving; f++) {
      const progress = (f + 1) / moving;
      const at = elapsed + (f + 1) / FPS;
      await page.evaluate(
        ([b, p, e, i, c]) =>
          (window as never as { paint: (...a: unknown[]) => void }).paint(b, p, e, i, c),
        [payload, progress, at, index, numbered] as const,
      );
      const file = resolve(work, `${String(shots.length).padStart(5, "0")}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, seconds: 1 / FPS });
    }

    // The rest of the beat is one picture, held. Nothing is moving, so nothing
    // is gained by photographing it five hundred more times.
    const held = Math.max(1 / FPS, seconds - moving / FPS);
    await page.evaluate(
      ([b, p, e, i, c]) =>
        (window as never as { paint: (...a: unknown[]) => void }).paint(b, p, e, i, c),
      [payload, 1, elapsed + seconds, index, numbered] as const,
    );
    const file = resolve(work, `${String(shots.length).padStart(5, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ file, seconds: held });

    elapsed += seconds;
  }

  await context.close();

  // ffmpeg's concat demuxer takes a still and a duration, which is exactly the
  // shape of what was just shot. The last entry is repeated because the
  // demuxer ignores the final duration otherwise and drops the closing frame.
  const list = shots
    .map((s) => `file '${s.file}'\nduration ${s.seconds.toFixed(4)}`)
    .concat(`file '${shots[shots.length - 1]!.file}'`)
    .join("\n");
  const listFile = resolve(work, "concat.txt");
  writeFileSync(listFile, list);

  const common = [
    "-y",
    "-loglevel", "error",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
    "-vf", `fps=${FPS},format=yuv420p`,
  ];

  const mp4 = resolve(outDir, `${panel.key}.mp4`);
  execFileSync(
    ffmpeg,
    [
      ...common,
      // H.264 in an MP4, and only that. It is the one video format that plays
      // everywhere without asking — which for a file an official will open on
      // whatever is on their desk is worth more than a smaller download.
      "-c:v", "libx264",
      "-preset", "medium",
      // Nearly every frame is identical to the one before it, so the encoder
      // has almost nothing to store either way. The preset is spent on speed and
      // the quality on the CRF, because what has to survive is small Persian
      // text — and that is what a low CRF protects.
      "-crf", "20",
      "-g", String(FPS * 4),
      // Some players refuse a file whose index sits at the end.
      "-movflags", "+faststart",
      mp4,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  rmSync(work, { recursive: true, force: true });

  const { statSync } = await import("node:fs");
  return { file: mp4, seconds: total, frames: shots.length, bytes: statSync(mp4).size };
}
