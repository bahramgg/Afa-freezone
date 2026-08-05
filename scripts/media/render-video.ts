import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { Browser } from "playwright";
import type { Panel } from "./content";
import { BEATS, beatSeconds, runtimeOf, type Beat } from "./storyboard";
import { videoShell, type Frame } from "./video-stage";

/**
 * Turns a panel's storyboard into an MP4.
 *
 * There is no soundtrack, so every word is on screen — but the words are now a
 * caption on a photograph of the panel, not a paragraph on an empty field, and
 * they are read in a glance rather than studied. That changes the shape of the
 * render: more beats, each much shorter.
 *
 * Only the moving part of a beat is photographed. The rest is one still held by
 * the encoder, because shooting a hundred identical pictures of a caption
 * nobody is animating costs minutes and buys nothing.
 */
const FPS = 25;
/** How long a beat takes to arrive. Quick — this is a tour, not a slideshow. */
const ENTRANCE_SECONDS = 0.34;

export type VideoResult = { file: string; seconds: number; frames: number; bytes: number };

const SHOT_DIR = resolve(import.meta.dirname, "shots");

/** A screenshot, inlined so the render page never touches the filesystem. */
function shotData(name: string): string {
  const file = resolve(SHOT_DIR, `${name}.png`);
  if (!existsSync(file)) {
    throw new Error(
      `missing screenshot "${name}" — run \`npm run guides:shoot\` against the demo server first`,
    );
  }
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
}

function frameFor(beat: Beat): Frame {
  if (beat.kind === "title") return { kind: "title", heading: beat.heading, sub: beat.sub };
  if (beat.kind === "shot") {
    return { kind: "shot", image: shotData(beat.shot), caption: beat.caption, step: beat.step };
  }
  return { kind: "flow", svg: beat.svg, caption: beat.caption, step: beat.step };
}

/** The bed, if one has been generated. Absent is not an error — just silence. */
const SCORE = resolve(import.meta.dirname, "assets", "score.wav");

export async function renderVideo(
  browser: Browser,
  panel: Panel,
  outDir: string,
  ffmpeg: string,
): Promise<VideoResult> {
  const beats = BEATS[panel.key];
  const total = runtimeOf(panel.key);
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

  const stills: { file: string; seconds: number }[] = [];
  let elapsed = 0;

  const paint = async (frame: Frame, progress: number, at: number) => {
    await page.evaluate(
      ([f, p, e]) => (window as never as { paint: (...a: unknown[]) => void }).paint(f, p, e),
      [frame, progress, at] as const,
    );
    // A freshly assigned <img src> is not necessarily decoded when the next
    // screenshot is taken, which shows up as one blank frame at each cut.
    await page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>("#shot");
      if (img && img.style.display !== "none" && !img.complete) await img.decode().catch(() => {});
    });
  };

  for (const beat of beats) {
    const seconds = beatSeconds(beat);
    const frame = frameFor(beat);

    const moving = Math.round(ENTRANCE_SECONDS * FPS);
    for (let f = 0; f < moving; f++) {
      await paint(frame, (f + 1) / moving, elapsed + (f + 1) / FPS);
      const file = resolve(work, `${String(stills.length).padStart(5, "0")}.png`);
      await page.screenshot({ path: file });
      stills.push({ file, seconds: 1 / FPS });
    }

    const held = Math.max(1 / FPS, seconds - moving / FPS);
    await paint(frame, 1, elapsed + seconds);
    const file = resolve(work, `${String(stills.length).padStart(5, "0")}.png`);
    await page.screenshot({ path: file });
    stills.push({ file, seconds: held });

    elapsed += seconds;
  }

  await context.close();

  const list = stills
    .map((s) => `file '${s.file}'\nduration ${s.seconds.toFixed(4)}`)
    .concat(`file '${stills[stills.length - 1]!.file}'`)
    .join("\n");
  const listFile = resolve(work, "concat.txt");
  writeFileSync(listFile, list);

  const mp4 = resolve(outDir, `${panel.key}.mp4`);
  const scored = existsSync(SCORE);
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-loglevel", "error",
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      // The bed, looped to the length of the film and faded at both ends. Well
      // under the picture in level: it is there so a silent room does not feel
      // like a fault, not to be listened to.
      ...(scored ? ["-stream_loop", "-1", "-i", SCORE] : []),
      ...(scored
        ? [
            "-filter_complex",
            `[1:a]volume=0.16,afade=t=in:st=0:d=3,afade=t=out:st=${Math.max(0, total - 4)}:d=4[a]`,
            "-map", "0:v",
            "-map", "[a]",
            "-c:a", "aac",
            "-b:a", "128k",
            "-shortest",
          ]
        : []),
      "-vf", `fps=${FPS},format=yuv420p`,
      // H.264 in an MP4, and only that. It is the one video format that plays
      // everywhere without asking — which for a file an official will open on
      // whatever is on their desk is worth more than a smaller download.
      "-c:v", "libx264",
      "-preset", "medium",
      // What has to survive the encode is small Persian text inside a
      // screenshot, and that is what a low CRF protects.
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
  return { file: mp4, seconds: total, frames: stills.length, bytes: statSync(mp4).size };
}
