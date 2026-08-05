import { FONTS } from "./stage";
import type { Flow, Panel } from "./content";

/**
 * The frame the new guides are drawn in.
 *
 * The old ones set a paragraph in the middle of a dark field and left most of
 * the frame empty, which is most of why they felt slow — there was nothing to
 * look at while the text was being read. Here the screenshot is the frame: it
 * fills everything above the caption, and the caption is one line.
 */
export const W = 1920;
export const H = 1080;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fa = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

export type Frame =
  | { kind: "title"; heading: string; sub?: string }
  | { kind: "shot"; image: string; caption: string }
  | { kind: "flow"; svg: string; caption: string };

const ACTOR_COLOR: Record<string, string> = {
  merchant: "#818cf8",
  foreign: "#38bdf8",
  admin: "#94a3b8",
  bank: "#34d399",
  chain: "#f0abfc",
};

/**
 * The flow, laid out to fill a 16:9 frame.
 *
 * The printed diagram is one long row, which suits a page and wastes a screen:
 * eight small circles in a band across the middle left two thirds of the frame
 * empty and the labels too small to read from a projector. Here the same nodes
 * wrap into rows, which makes each one large enough to read and fills the space
 * the video actually has.
 */
export function flowSvg(flow: Flow, active: number | undefined) {
  const nodes = flow.nodes;
  const perRow = nodes.length > 5 ? Math.ceil(nodes.length / 2) : nodes.length;
  const rows = Math.ceil(nodes.length / perRow);

  const width = 1760;
  const rowH = rows > 1 ? 300 : 330;
  const height = rows * rowH + 40;
  const r = 46;
  const colW = width / perRow;
  // Right to left, because that is the direction the reader's eye travels.
  const cx = (col: number) => width - colW * col - colW / 2;
  const cy = (row: number) => 70 + row * rowH + r;

  const dim = "#334155";
  const label = "#8fa0c0";
  const labelOn = "#f1f5f9";
  const parts: string[] = [];

  const place = (i: number) => ({ row: Math.floor(i / perRow), col: i % perRow });

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = place(i);
    const b = place(i + 1);
    const done = active !== undefined && i < active;
    const stroke = done ? ACTOR_COLOR[nodes[i + 1]!.actor] ?? dim : dim;
    if (a.row === b.row) {
      parts.push(
        `<line x1="${cx(a.col) - r}" y1="${cy(a.row)}" x2="${cx(b.col) + r}" y2="${cy(b.row)}" stroke="${stroke}" stroke-width="${done ? 4 : 3}" stroke-linecap="round" ${done ? "" : 'stroke-dasharray="7 9"'} />`,
      );
    } else {
      // Down the far edge and back along the next row, so the eye follows the
      // order rather than guessing it.
      const y1 = cy(a.row);
      const y2 = cy(b.row);
      const edge = 40;
      parts.push(
        `<path d="M ${cx(a.col) - r} ${y1} H ${edge} V ${y2} H ${cx(b.col) + r}" fill="none" stroke="${stroke}" stroke-width="${done ? 4 : 3}" stroke-linecap="round" stroke-linejoin="round" ${done ? "" : 'stroke-dasharray="7 9"'} />`,
      );
    }
  }

  nodes.forEach((node, i) => {
    const { row, col } = place(i);
    const color = ACTOR_COLOR[node.actor] ?? dim;
    const isActive = active === i;
    const isDone = active !== undefined && i < active;
    const survey = active === undefined;
    const lit = isActive || isDone || survey;
    const x = cx(col);
    const y = cy(row);

    if (isActive) {
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${r + 18}" fill="none" stroke="${color}" stroke-width="3" opacity="0.4" />`,
      );
    }
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${lit ? color : "none"}" fill-opacity="${isActive ? 1 : isDone ? 0.3 : survey ? 0.18 : 0}" stroke="${lit ? color : dim}" stroke-width="${isActive ? 4 : 3}" />`,
      `<text x="${x}" y="${y + 13}" text-anchor="middle" font-family="Vazirmatn" font-size="36" font-weight="700" fill="${isActive ? "#0b1120" : lit ? color : dim}">${fa(i + 1)}</text>`,
    );
    node.label.split("\n").forEach((line, k) => {
      parts.push(
        `<text x="${x}" y="${y + r + 48 + k * 34}" text-anchor="middle" font-family="Vazirmatn" font-size="${isActive ? 28 : 26}" font-weight="${isActive ? 600 : 400}" fill="${isActive || survey ? labelOn : label}">${esc(line)}</text>`,
      );
    });
  });

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">${parts.join("")}</svg>`;
}

/**
 * One page that draws every frame, driven from Node.
 *
 * Rebuilding the document per frame would reload the font on every one of a
 * few thousand screenshots. Instead the page is opened once and `paint` swaps
 * what is on it.
 */
export function videoShell(panel: Panel, totalSeconds: number) {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{
  font-family:Vazirmatn,sans-serif;
  background:#0b1220;
  color:#e8eefc;
  position:relative;
}

/* A thin band of the panel's own colour, so the four videos are told apart
   at a glance rather than by reading the title. */
#accent{position:absolute;inset:0 0 auto 0;height:6px;background:${panel.accent};z-index:5}

#stage{position:absolute;inset:6px 0 var(--bar,168px) 0;display:flex;align-items:center;justify-content:center;padding:26px 44px}

/* The screenshot. Contained rather than cropped — a guide that cuts the edge
   off a table is showing something the viewer will not find on their screen. */
#shot{max-width:100%;max-height:100%;border-radius:14px;
  box-shadow:0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08);
  opacity:0;transform:scale(.985);display:none}
#flowbox{display:none;width:100%;height:100%;align-items:center;justify-content:center;opacity:0}
#flowbox svg{max-width:100%;max-height:100%}

/* The caption. One line, large enough to read from the back of a room. */
#bar{position:absolute;inset:auto 0 0 0;height:168px;display:flex;align-items:center;
  justify-content:center;padding:0 90px 26px;
  background:linear-gradient(to top,rgba(6,11,22,.98),rgba(6,11,22,.86) 62%,transparent)}
#caption{font-size:40px;line-height:1.5;font-weight:500;text-align:center;
  max-width:1600px;opacity:0;transform:translateY(12px)}

/* Title cards take the whole frame; there is no screenshot to share it with. */
#title{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;
  justify-content:center;gap:22px;text-align:center;padding:0 140px}
#title h1{font-size:96px;font-weight:700;letter-spacing:-.5px}
#title p{font-size:40px;font-weight:400;color:#a9b6d4}
#title .rule{width:150px;height:5px;border-radius:99px;background:${panel.accent}}

#progress{position:absolute;inset:auto 0 0 0;height:5px;background:rgba(255,255,255,.09);z-index:6}
#progress i{display:block;height:100%;width:0;background:${panel.accent}}
#label{position:absolute;top:26px;inset-inline-end:44px;font-size:22px;color:#7f8db0;z-index:6}
#clock{position:absolute;top:26px;inset-inline-start:44px;font-size:22px;color:#7f8db0;
  font-variant-numeric:tabular-nums;z-index:6}
</style></head><body>
<div id="accent"></div>
<div id="label">${esc(panel.title)}</div>
<div id="clock"></div>

<div id="stage">
  <img id="shot" alt="">
  <div id="flowbox"></div>
</div>

<div id="title"><h1></h1><div class="rule"></div><p></p></div>

<div id="bar"><div id="caption"></div></div>
<div id="progress"><i></i></div>

<script>
const $ = (s) => document.querySelector(s);
const TOTAL = ${totalSeconds};
const fa = (s) => String(s).replace(/\\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/**
 * @param frame  what to show
 * @param t      0..1 through this beat's entrance, for the fade
 * @param elapsed seconds into the video
 */
window.paint = (frame, t, elapsed) => {
  const shot = $("#shot"), flow = $("#flowbox"), title = $("#title"),
        cap = $("#caption"), bar = $("#bar");
  const ease = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);

  shot.style.display = "none";
  flow.style.display = "none";
  title.style.display = "none";
  bar.style.display = "flex";
  document.body.style.setProperty("--bar", "168px");

  if (frame.kind === "title") {
    title.style.display = "flex";
    title.style.opacity = ease;
    title.style.transform = "translateY(" + (1 - ease) * 16 + "px)";
    title.querySelector("h1").textContent = frame.heading;
    title.querySelector("p").textContent = frame.sub || "";
    bar.style.display = "none";
  } else if (frame.kind === "shot") {
    shot.style.display = "block";
    shot.src = frame.image;
    shot.style.opacity = ease;
    shot.style.transform = "scale(" + (0.985 + 0.015 * ease) + ")";
    cap.textContent = frame.caption;
  } else {
    flow.style.display = "flex";
    flow.innerHTML = frame.svg;
    flow.style.opacity = ease;
    cap.textContent = frame.caption;
  }

  if (frame.kind !== "title") {
    cap.style.opacity = ease;
    cap.style.transform = "translateY(" + (1 - ease) * 12 + "px)";
  }

  $("#progress i").style.width = Math.min(100, (elapsed / TOTAL) * 100) + "%";
  const left = Math.max(0, Math.round(TOTAL - elapsed));
  $("#clock").textContent = fa(Math.floor(left / 60)) + ":" + fa(String(left % 60).padStart(2, "0"));
};
</script></body></html>`;
}

export { esc, fa };
