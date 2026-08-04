import { resolve } from "node:path";
import { statSync } from "node:fs";
import type { Browser } from "playwright";
import type { Panel } from "./content";
import { diagram, esc, FONTS, legend } from "./stage";

/**
 * The written guide.
 *
 * Printed rather than projected, so it is light, it is set in a column narrow
 * enough to read without losing the line, and it carries a cover page — these
 * are handed to people, and a document that arrives without saying what it is
 * gets put down.
 */
export type PdfResult = { file: string; bytes: number };

function section(s: Panel["document"][number]) {
  const parts: string[] = [];
  parts.push(`<section class="${s.breakBefore ? "break" : ""}">`);
  parts.push(`<h2>${esc(s.heading)}</h2>`);

  for (const p of s.paragraphs ?? []) parts.push(`<p>${esc(p)}</p>`);

  if (s.flow) {
    parts.push(
      `<figure><figcaption><b>${esc(s.flow.title)}</b><span>${esc(s.flow.subtitle)}</span></figcaption>` +
        diagram(s.flow, undefined, { dark: false, width: 1180 }) +
        legend(false) +
        `</figure>`,
    );
  }

  if (s.steps?.length) {
    parts.push("<ol>");
    for (const step of s.steps) {
      parts.push(`<li><b>${esc(step.title)}</b><span>${esc(step.text)}</span></li>`);
    }
    parts.push("</ol>");
  }

  if (s.bullets?.length) {
    parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
  }

  parts.push("</section>");
  return parts.join("");
}

function document_(panel: Panel, dateLabel: string) {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:20mm 18mm 18mm}
body{font-family:Vazirmatn,sans-serif;color:#0f172a;font-size:11.2pt;line-height:2.05;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}

.cover{height:232mm;display:flex;flex-direction:column;justify-content:center;text-align:center;
  page-break-after:always}
.cover .mark{width:64px;height:6px;border-radius:3px;background:${panel.accent};margin:0 auto 30px}
.cover .kicker{font-size:12pt;color:${panel.accent};font-weight:500;letter-spacing:.4px}
.cover h1{font-size:30pt;font-weight:700;line-height:1.35;margin:14px 0 8px;letter-spacing:-.6px}
.cover .sub{font-size:13pt;color:#475569;font-weight:500}
.cover .purpose{font-size:11.5pt;color:#64748b;max-width:135mm;margin:26px auto 0;line-height:2}
.cover .meta{margin-top:38px;font-size:10pt;color:#94a3b8}

section{page-break-inside:auto;margin-bottom:11mm}
section.break{page-break-before:always}
h2{font-size:16pt;font-weight:700;margin-bottom:6mm;padding-bottom:2.6mm;letter-spacing:-.3px;
  border-bottom:2px solid ${panel.accent}}
p{margin-bottom:4.2mm;text-align:justify;color:#1e293b}

figure{margin:6mm 0;padding:5mm 3mm 3mm;border:1px solid #e2e8f0;border-radius:8px;
  background:#f8fafc;page-break-inside:avoid}
figcaption{display:flex;gap:8px;align-items:baseline;padding:0 4mm 2mm}
figcaption b{font-size:11pt;font-weight:700}
figcaption span{font-size:9.5pt;color:#64748b}

ol{list-style:none;counter-reset:step;margin:4mm 0}
ol li{counter-increment:step;position:relative;padding-inline-start:12mm;margin-bottom:4.6mm;
  page-break-inside:avoid}
ol li::before{content:counter(step);position:absolute;inset-inline-start:0;top:.5mm;
  width:8mm;height:8mm;border-radius:50%;background:${panel.accent};color:#fff;
  font-size:10pt;font-weight:700;display:flex;align-items:center;justify-content:center}
ol li b{display:block;font-size:11.8pt;font-weight:700;margin-bottom:1.2mm}
ol li span{display:block;text-align:justify;color:#334155}

ul{list-style:none;margin:3mm 0}
ul li{position:relative;padding-inline-start:7mm;margin-bottom:3mm;color:#334155;text-align:justify}
ul li::before{content:"";position:absolute;inset-inline-start:1.5mm;top:3.2mm;width:2.4mm;height:2.4mm;
  border-radius:1px;background:${panel.accent}}

.legend{display:flex;gap:6mm;justify-content:center;padding:2mm 0 0;flex-wrap:wrap}
.leg{display:inline-flex;align-items:center;gap:1.6mm;font-size:8.6pt;color:#64748b}
.leg i{width:2.6mm;height:2.6mm;border-radius:1px;display:inline-block}
</style></head><body>

<div class="cover">
  <div class="mark"></div>
  <div class="kicker">راهنمای کارکرد سامانه</div>
  <h1>${esc(panel.title)}</h1>
  <div class="sub">سامانهٔ پرداخت ارزی سازمان منطقه آزاد</div>
  <p class="purpose">${esc(panel.purpose)}</p>
  <div class="meta">مخاطب: ${esc(panel.audience)}<br>${esc(dateLabel)}</div>
</div>

${panel.document.map(section).join("")}
</body></html>`;
}

export async function renderPdf(
  browser: Browser,
  panel: Panel,
  outDir: string,
  dateLabel: string,
): Promise<PdfResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(document_(panel, dateLabel), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const file = resolve(outDir, `${panel.key}.pdf`);
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "18mm", left: "18mm", right: "18mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    // Persian digits in the footer would need the embedded font, which the
    // header/footer templates do not get. Latin numerals are the honest choice
    // here rather than a page number nobody can read.
    footerTemplate:
      `<div style="width:100%;padding:0 18mm;font-family:sans-serif;font-size:8pt;color:#94a3b8;` +
      `display:flex;justify-content:space-between;direction:rtl">` +
      `<span>${esc(panel.title)}</span><span class="pageNumber"></span></div>`,
  });

  await context.close();
  return { file, bytes: statSync(file).size };
}
