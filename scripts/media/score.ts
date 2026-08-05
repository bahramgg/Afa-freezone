import { writeFileSync } from "node:fs";

/**
 * The bed the guides play over.
 *
 * Synthesised rather than licensed: the videos are served from the free zone's
 * own site, and a track whose rights nobody can produce is a liability sitting
 * under an official document.
 *
 * It carries a pulse. The first version was chords swelling into each other with
 * no beat at all, which under a step-by-step walkthrough read as waiting-room
 * music — it gave the film no forward motion. A plucked arpeggio on eighths and
 * a root note on the downbeat give it a tempo to walk to, quietly: this still
 * has to sit under a document and never ask to be listened to.
 *
 * Swappable: the render uses `scripts/media/assets/score.wav` whatever produced
 * it, so a real track replaces this by overwriting one file.
 */
const RATE = 44100;

/** Unhurried, but a tempo you could nod to. */
const BPM = 76;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

/** A note, as a frequency. Equal temperament from A4. */
const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/**
 * i — VI — III — VII in A minor, a bar each, twice through.
 *
 * A minor key reads as serious rather than sombre at this tempo, which is what a
 * document for an official wants; four chords cycling means the loop point is
 * never a surprise.
 */
const CHORDS: number[][] = [
  [-12, -5, 0, 4], // Am
  [-16, -9, -4, 3], // F
  [-21, -14, -9, -2], // C
  [-14, -7, -2, 5], // G
];

const BARS = CHORDS.length * 2;
const LENGTH = BAR * BARS + 2;

type Voice = { left: Float64Array; right: Float64Array };

function main() {
  const n = Math.floor(RATE * LENGTH);
  const out: Voice = { left: new Float64Array(n), right: new Float64Array(n) };

  const add = (at: number, i: number, v: number, pan: number) => {
    const k = at + i;
    if (k < 0 || k >= n) return;
    out.left[k] += v * (1 - pan);
    out.right[k] += v * pan;
  };

  /** A plucked note: fast on, exponential off. This is what makes the rhythm. */
  const pluck = (start: number, semi: number, dur: number, gain: number, pan: number) => {
    const f = note(semi);
    const at = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    for (let i = 0; i < len; i++) {
      const t = i / RATE;
      // 6ms attack, so the onset is audible without clicking.
      const attack = Math.min(1, t / 0.006);
      const decay = Math.exp(-t * 4.2);
      const s =
        Math.sin(2 * Math.PI * f * t) +
        Math.sin(2 * Math.PI * f * 2 * t) * 0.22 * Math.exp(-t * 9) +
        Math.sin(2 * Math.PI * f * 3 * t) * 0.08 * Math.exp(-t * 13);
      add(at, i, s * attack * decay * gain, pan);
    }
  };

  /** The chord underneath, slow and quiet — context, not content. */
  const pad = (start: number, semi: number, dur: number, gain: number, pan: number) => {
    const f = note(semi);
    const at = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    const attack = 0.9;
    const release = 1.1;
    for (let i = 0; i < len; i++) {
      const t = i / RATE;
      const env =
        t < attack
          ? Math.pow(t / attack, 1.6)
          : t > dur - release
            ? Math.pow(Math.max(0, dur - t) / release, 1.7)
            : 1;
      const s = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 2 * t) * 0.1;
      add(at, i, s * env * gain, pan);
    }
  };

  /** The downbeat. Low, short, and felt more than heard. */
  const bass = (start: number, semi: number, gain: number) => {
    const f = note(semi);
    const at = Math.floor(start * RATE);
    const len = Math.floor(0.85 * RATE);
    for (let i = 0; i < len; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.01);
      const decay = Math.exp(-t * 3.0);
      add(at, i, Math.sin(2 * Math.PI * f * t) * attack * decay * gain, 0.5);
    }
  };

  for (let bar = 0; bar < BARS; bar++) {
    const chord = CHORDS[bar % CHORDS.length]!;
    const start = bar * BAR;

    // Pad: the upper three voices, held across the bar.
    chord.slice(1).forEach((semi, v) => {
      pad(start, semi, BAR + 0.5, 0.030, 0.35 + v * 0.15);
    });

    // Bass on beats one and three.
    bass(start, chord[0]! - 12, 0.075);
    bass(start + BEAT * 2, chord[0]! - 12, 0.048);

    /**
     * The arpeggio: eight notes to the bar, up and back down.
     *
     * Not a straight run — the shape turns over at the top, so the ear hears a
     * figure repeating rather than a scale being practised.
     */
    const shape = [0, 1, 2, 3, 2, 3, 1, 2];
    for (let e = 0; e < 8; e++) {
      const semi = chord[shape[e]!]! + (e === 3 || e === 5 ? 12 : 0);
      // The offbeats sit back, which is most of what makes it feel like a
      // rhythm rather than a metronome.
      const gain = e % 2 === 0 ? 0.052 : 0.032;
      pluck(start + e * (BEAT / 2), semi, 0.9, gain, e % 2 === 0 ? 0.42 : 0.58);
    }
  }

  const { left, right } = out;

  // One long, quiet reflection. Enough to suggest a room.
  const delay = Math.floor(0.29 * RATE);
  for (let i = delay; i < n; i++) {
    left[i]! += right[i - delay]! * 0.17;
    right[i]! += left[i - delay]! * 0.17;
  }

  // A gentle low-pass: the top of a sine stack is where it sounds cheap. Kept
  // higher than the padded version was, or the plucks lose their attack and the
  // rhythm goes with it.
  let lp = 0;
  let rp = 0;
  const a = 0.42;
  for (let i = 0; i < n; i++) {
    lp += a * (left[i]! - lp);
    rp += a * (right[i]! - rp);
    left[i] = lp;
    right[i] = rp;
  }

  // Cross-fade the tail over the head so the loop has no seam.
  const fade = Math.floor(BAR * RATE);
  const usable = n - fade;
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    left[i] = left[i]! * k + left[usable + i]! * (1 - k);
    right[i] = right[i]! * k + right[usable + i]! * (1 - k);
  }

  const pcm = Buffer.alloc(usable * 4);
  let peak = 0;
  for (let i = 0; i < usable; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const gain = peak > 0 ? 0.78 / peak : 1;
  for (let i = 0; i < usable; i++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i]! * gain)) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i]! * gain)) * 32767), i * 4 + 2);
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

  const out2 = new URL("./assets/score.wav", import.meta.url).pathname;
  writeFileSync(out2, Buffer.concat([header, pcm]));
  console.log(
    `${(usable / RATE).toFixed(1)}s loop at ${BPM} BPM → scripts/media/assets/score.wav`,
  );
}

main();
