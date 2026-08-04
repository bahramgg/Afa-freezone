import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Beat, Flow, Panel } from "./content";

/**
 * The look of both guides.
 *
 * One stylesheet serves the video frames and the printed pages, because they
 * describe the same thing and a reader who watches one and then reads the other
 * should recognise the second as the same document. The video is dark — it is
 * projected in a room — and the document is light, because it is printed.
 */

const ASSETS = resolve(import.meta.dirname, "assets");

/**
 * Fonts are embedded rather than linked.
 *
 * A Persian page rendered without its font falls back to something that does
 * not join its letters, and the failure is silent: the render succeeds and the
 * text is unreadable. Inlining removes the network from a step that has no
 * business depending on it.
 */
function fontFace(weight: number) {
  const data = readFileSync(resolve(ASSETS, `Vazirmatn-${weight}.ttf`)).toString("base64");
  return `@font-face{font-family:Vazirmatn;font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/ttf;base64,${data}) format("truetype")}`;
}

export const FONTS = [400, 500, 700].map(fontFace).join("\n");

/** Who is acting at a given node, and the colour that says so. */
const ACTOR_COLOR: Record<string, string> = {
  merchant: "#818cf8",
  foreign: "#38bdf8",
  admin: "#94a3b8",
  bank: "#34d399",
  chain: "#f0abfc",
};

const ACTOR_NAME: Record<string, string> = {
  merchant: "بازرگان ایرانی",
  foreign: "طرف خارجی",
  admin: "سازمان",
  bank: "بانک عامل",
  chain: "سامانه و شبکه",
};

// ────────────────────────────────────────────────────────── the diagram ──

/**
 * The flow, drawn once and reused everywhere.
 *
 * Right to left, because that is the direction the reader's eye already
 * travels. Nodes behind the active one are filled in: the point of showing the
 * whole chain on every step is that the viewer can always see how far along the
 * trade is and what is still ahead of it.
 */
export function diagram(flow: Flow, active: number | undefined, opts: { dark: boolean; width: number }) {
  const { dark, width } = opts;
  const n = flow.nodes.length;
  const pad = 40;
  const gap = (width - pad * 2) / n;
  const cx = (i: number) => width - pad - gap * i - gap / 2; // right to left
  const cy = 92;
  const r = 27;

  const dim = dark ? "#334155" : "#cbd5e1";
  const label = dark ? "#94a3b8" : "#64748b";
  const labelOn = dark ? "#f1f5f9" : "#0f172a";

  const parts: string[] = [];

  /**
   * With no step being described — the printed page — the chain is not partly
   * travelled, it is simply the map. Every node is drawn in the colour of
   * whoever acts there, which is the only thing that makes the key underneath
   * it worth printing.
   */
  const survey = active === undefined;

  // Connectors first, so the nodes sit on top of them.
  for (let i = 0; i < n - 1; i++) {
    const from = cx(i) - r;
    const to = cx(i + 1) + r;
    const done = !survey && i < active;
    parts.push(
      `<line x1="${from}" y1="${cy}" x2="${to}" y2="${cy}" stroke="${done ? ACTOR_COLOR[flow.nodes[i + 1]!.actor] : dim}" stroke-width="${done ? 3 : 2}" stroke-linecap="round" ${done || survey ? "" : 'stroke-dasharray="5 6"'} />`,
    );
  }

  flow.nodes.forEach((node, i) => {
    const color = ACTOR_COLOR[node.actor] ?? dim;
    const isActive = active === i;
    const isDone = !survey && i < active;
    const lit = isActive || isDone || survey;

    if (isActive) {
      parts.push(
        `<circle cx="${cx(i)}" cy="${cy}" r="${r + 11}" fill="none" stroke="${color}" stroke-width="2" opacity="0.45" />`,
      );
    }
    const fillOpacity = isActive ? 1 : isDone ? 0.28 : survey ? 0.16 : 0;
    parts.push(
      `<circle cx="${cx(i)}" cy="${cy}" r="${r}" fill="${lit ? color : "none"}" fill-opacity="${fillOpacity}" stroke="${lit ? color : dim}" stroke-width="${isActive ? 3 : 2}" />`,
    );
    parts.push(
      `<text x="${cx(i)}" y="${cy + 7}" text-anchor="middle" font-family="Vazirmatn" font-size="20" font-weight="700" fill="${isActive ? (dark ? "#0b1120" : "#ffffff") : lit ? color : dim}">${fa(i + 1)}</text>`,
    );

    node.label.split("\n").forEach((line, k) => {
      parts.push(
        `<text x="${cx(i)}" y="${cy + r + 30 + k * 21}" text-anchor="middle" font-family="Vazirmatn" font-size="${isActive ? 16 : 15}" font-weight="${isActive || survey ? 500 : 400}" fill="${isActive || survey ? labelOn : label}">${esc(line)}</text>`,
      );
    });
  });

  return `<svg viewBox="0 0 ${width} 190" width="100%" style="display:block">${parts.join("")}</svg>`;
}

/** A key to the colours, so a node's colour means something. */
export function legend(dark: boolean) {
  const items = Object.entries(ACTOR_NAME)
    .map(
      ([key, name]) =>
        `<span class="leg"><i style="background:${ACTOR_COLOR[key]}"></i>${name}</span>`,
    )
    .join("");
  return `<div class="legend" data-dark="${dark}">${items}</div>`;
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Persian digits. The rest of the system renders numbers this way; so does this. */
export const fa = (value: string | number) =>
  String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

// ──────────────────────────────────────────────────────── the video page ──

/**
 * The page the frames are shot from.
 *
 * It is loaded once and then told what to draw, rather than rebuilt per frame:
 * a fresh document per frame would re-decode the embedded fonts several
 * thousand times for no benefit.
 */
export function videoShell(panel: Panel, totalSeconds: number) {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#0b1120;color:#e2e8f0;
  font-family:Vazirmatn,sans-serif;-webkit-font-smoothing:antialiased}
.frame{position:relative;width:1920px;height:1080px;display:flex;flex-direction:column;
  background:radial-gradient(1400px 700px at 78% -12%, ${panel.accent}1f, transparent 62%), #0b1120}

header{display:flex;align-items:center;justify-content:space-between;padding:34px 64px 0}
.brand{display:flex;align-items:center;gap:14px}
.dot{width:13px;height:13px;border-radius:50%;background:${panel.accent}}
.brand b{font-size:23px;font-weight:700;letter-spacing:-.2px}
.brand span{font-size:17px;color:#64748b}
.sys{font-size:17px;color:#64748b}

main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:14px 96px 0;gap:34px}

.kicker{font-size:20px;font-weight:500;color:${panel.accent};letter-spacing:.3px}
h1{font-size:78px;font-weight:700;line-height:1.18;letter-spacing:-1.6px}
h2{font-size:56px;font-weight:700;line-height:1.24;letter-spacing:-1px}
h3{font-size:44px;font-weight:700;line-height:1.3;letter-spacing:-.6px}
p.body{font-size:31px;line-height:1.95;color:#cbd5e1;max-width:1500px;font-weight:400}
p.lede{font-size:27px;line-height:1.9;color:#94a3b8;max-width:1300px}

ul{list-style:none;display:flex;flex-direction:column;gap:19px;margin-top:6px}
li{position:relative;padding-inline-start:42px;font-size:28px;line-height:1.75;color:#cbd5e1}
li::before{content:"";position:absolute;inset-inline-start:8px;top:16px;width:11px;height:11px;
  border-radius:3px;background:${panel.accent}}

.flowbox{background:#0f172acc;border:1px solid #1e293b;border-radius:22px;padding:26px 22px 16px}
.flowhead{display:flex;align-items:baseline;gap:16px;padding:0 20px 6px}
.flowhead b{font-size:22px;font-weight:700;color:#e2e8f0}
.flowhead span{font-size:18px;color:#64748b}

.legend{display:flex;gap:26px;justify-content:center;padding:12px 0 2px;flex-wrap:wrap}
.leg{display:inline-flex;align-items:center;gap:9px;font-size:16px;color:#94a3b8}
.leg i{width:11px;height:11px;border-radius:3px;display:inline-block}

footer{display:flex;align-items:center;justify-content:space-between;padding:0 64px 34px;gap:30px}
.counter{font-size:18px;color:#64748b;white-space:nowrap}
.track{flex:1;height:5px;border-radius:3px;background:#1e293b;overflow:hidden}
.fill{height:100%;background:${panel.accent};border-radius:3px}

.cover{align-items:center;text-align:center;justify-content:center}
.cover .rule{width:150px;height:5px;border-radius:3px;background:${panel.accent};margin:6px auto}

/* The entrance. Everything that changes between beats moves together, so the
   eye is drawn once per beat rather than chasing several things at once. */
.anim{will-change:transform,opacity}
</style></head><body>
<div class="frame">
  <header>
    <div class="brand"><span class="dot"></span><b>${esc(panel.title)}</b><span>سامانهٔ پرداخت ارزی سازمان منطقه آزاد</span></div>
    <div class="sys" id="sys"></div>
  </header>
  <main id="main"></main>
  <footer>
    <div class="counter" id="counter"></div>
    <div class="track"><div class="fill" id="fill" style="width:0%"></div></div>
  </footer>
</div>
<script>
const TOTAL = ${totalSeconds};
const ACTOR_COLOR = ${JSON.stringify(ACTOR_COLOR)};

window.paint = function (beat, progress, elapsed, index, count) {
  const main = document.getElementById("main");
  const eased = progress >= 1 ? 1 : 1 - Math.pow(1 - progress, 3);

  const blocks = [];
  if (beat.kind === "cover") {
    blocks.push('<div class="kicker">راهنمای کارکرد</div>');
    blocks.push("<h1>" + beat.heading + "</h1>");
    blocks.push('<div class="rule"></div>');
    if (beat.body) blocks.push('<p class="lede">' + beat.body + "</p>");
  } else {
    if (beat.flowHtml) {
      blocks.push(
        '<div class="flowbox"><div class="flowhead"><b>' + beat.flowTitle +
        "</b><span>" + beat.flowSubtitle + "</span></div>" + beat.flowHtml + beat.legendHtml + "</div>",
      );
    }
    blocks.push((beat.kind === "section" ? "<h2>" : "<h3>") + beat.heading + (beat.kind === "section" ? "</h2>" : "</h3>"));
    if (beat.body) blocks.push('<p class="body">' + beat.body + "</p>");
    if (beat.bullets && beat.bullets.length) {
      blocks.push("<ul>" + beat.bullets.map((b) => "<li>" + b + "</li>").join("") + "</ul>");
    }
  }

  main.className = beat.kind === "cover" || beat.kind === "close" ? "cover" : "";
  main.innerHTML = blocks.join("");

  // The whole block arrives together, lifting into place.
  main.style.opacity = String(0.15 + 0.85 * eased);
  main.style.transform = "translateY(" + ((1 - eased) * 26).toFixed(2) + "px)";

  document.getElementById("counter").textContent =
    beat.kind === "cover" ? "" : "بخش " + toFa(index) + " از " + toFa(count);
  document.getElementById("fill").style.width = ((elapsed / TOTAL) * 100).toFixed(2) + "%";
  document.getElementById("sys").textContent = fmt(elapsed) + " / " + fmt(TOTAL);
};

function toFa(n) { return String(n).replace(/\\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]); }
function fmt(s) {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return toFa(m) + ":" + toFa(String(r).padStart(2, "0"));
}
</script></body></html>`;
}

/** What `paint` needs, with the diagram already drawn. */
export function beatPayload(beat: Beat) {
  return {
    kind: beat.kind,
    heading: esc(beat.heading),
    body: beat.body ? esc(beat.body) : undefined,
    bullets: beat.bullets?.map(esc),
    flowHtml: beat.flow ? diagram(beat.flow, beat.active, { dark: true, width: 1728 }) : undefined,
    flowTitle: beat.flow ? esc(beat.flow.title) : undefined,
    flowSubtitle: beat.flow ? esc(beat.flow.subtitle) : undefined,
    legendHtml: beat.flow ? legend(true) : undefined,
  };
}
