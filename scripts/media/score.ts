import { writeFileSync } from "node:fs";

/**
 * The bed the guides play over.
 *
 * Synthesised rather than licensed: the videos are served from the free zone's
 * own site, and a track whose rights nobody can produce is a liability sitting
 * under an official document. This is a few sine tones with a slow envelope —
 * quiet, unhurried, and deliberately uneventful, because a guide is watched for
 * what is on the screen and music that asks to be noticed is working against it.
 *
 * Swappable: `npm run guides` will use `scripts/media/assets/score.wav`
 * whatever produced it, so a real track can replace this by overwriting a file.
 */
const RATE = 44100;

/** A note, as a frequency. Equal temperament from A4. */
const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/**
 * The progression: i — VI — III — VII in A minor, four bars each.
 *
 * A minor key read as serious rather than sombre at this tempo, which is what a
 * document for an official wants; the same four chords cycle so the loop point
 * is never a surprise.
 */
const CHORDS: number[][] = [
  [-12, -5, 0, 4], // Am
  [-16, -9, -4, 3], // F
  [-21, -14, -9, -2], // C
  [-14, -7, -2, 5], // G
];

const BAR = 6.0;
const BARS = CHORDS.length * 2;
const LENGTH = BAR * BARS;

/** Slow in, slow out — nothing here should have an attack you can hear. */
function envelope(t: number, dur: number) {
  const attack = 1.6;
  const release = 2.4;
  if (t < attack) return Math.pow(t / attack, 1.7);
  if (t > dur - release) return Math.pow(Math.max(0, dur - t) / release, 1.8);
  return 1;
}

function main() {
  const n = Math.floor(RATE * LENGTH);
  const left = new Float64Array(n);
  const right = new Float64Array(n);

  for (let bar = 0; bar < BARS; bar++) {
    const chord = CHORDS[bar % CHORDS.length]!;
    const start = bar * BAR;

    chord.forEach((semi, voice) => {
      const f = note(semi);
      // Each voice enters a little after the one below it, so a chord arrives
      // as a swell rather than a block.
      const offset = voice * 0.22;
      const dur = BAR + 1.6;
      const pan = 0.5 + (voice - 1.5) * 0.12;

      for (let i = 0; i < RATE * dur; i++) {
        const t = i / RATE;
        const at = Math.floor((start + offset) * RATE) + i;
        if (at < 0 || at >= n) continue;

        const env = envelope(t, dur);
        // A little of the second and third harmonic, falling away quickly —
        // enough to stop it sounding like a test tone.
        const s =
          Math.sin(2 * Math.PI * f * t) * 1.0 +
          Math.sin(2 * Math.PI * f * 2 * t) * 0.14 +
          Math.sin(2 * Math.PI * f * 3 * t) * 0.05;
        // A very slow beat between the voices keeps it from sounding static.
        const drift = 1 + 0.004 * Math.sin(2 * Math.PI * 0.07 * (start + t) + voice);

        const v = s * env * 0.055 * drift;
        left[at] += v * (1 - pan);
        right[at] += v * pan;
      }
    });
  }

  // One reflection, long and quiet. Enough to suggest a room.
  const delay = Math.floor(0.33 * RATE);
  for (let i = delay; i < n; i++) {
    left[i] += right[i - delay] * 0.19;
    right[i] += left[i - delay] * 0.19;
  }

  // A gentle low-pass: the top end of a sine stack is where it sounds cheap.
  let lp = 0;
  let rp = 0;
  const a = 0.22;
  for (let i = 0; i < n; i++) {
    lp += a * (left[i] - lp);
    rp += a * (right[i] - rp);
    left[i] = lp;
    right[i] = rp;
  }

  // Cross-fade the tail over the head so the loop has no seam.
  const fade = Math.floor(2.5 * RATE);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    left[i] = left[i] * k + left[n - fade + i] * (1 - k);
    right[i] = right[i] * k + right[n - fade + i] * (1 - k);
  }
  const usable = n - fade;

  const pcm = Buffer.alloc(usable * 4);
  let peak = 0;
  for (let i = 0; i < usable; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak > 0 ? 0.72 / peak : 1;
  for (let i = 0; i < usable; i++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), i * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  const out = new URL("./assets/score.wav", import.meta.url).pathname;
  writeFileSync(out, Buffer.concat([header, pcm]));
  console.log(`${(usable / RATE).toFixed(1)}s loop → scripts/media/assets/score.wav`);
}

main();
