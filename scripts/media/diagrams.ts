/**
 * The drawings a walkthrough needs, one kind per thing being explained.
 *
 * The first guides drew one diagram — the whole trade as a row of circles — and
 * showed it again at every step with a different circle lit. That answers "where
 * are we" and nothing else, so a viewer being told about a fee split, a rial
 * account or a deposit address saw the same picture each time and learned to
 * stop looking at it.
 *
 * These are separate shapes because they answer separate questions: who is
 * involved, where in the path we are, how one number becomes three, what a
 * status means, and what happens when the deal is called off.
 */
const C = {
  merchant: "#818cf8",
  foreign: "#38bdf8",
  admin: "#94a3b8",
  bank: "#34d399",
  chain: "#f0abfc",
  dim: "#334155",
  text: "#e8eefc",
  mute: "#8fa0c0",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fa = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

const svg = (w: number, h: number, body: string) =>
  `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" direction="rtl" style="display:block">${body}</svg>`;

/**
 * Right-aligned, in a right-to-left drawing.
 *
 * SVG's `text-anchor` is about the inline direction of the text, not the page:
 * in an RTL run "end" is the left edge, so a label anchored "end" at the right
 * margin grows off the frame. "start" is the one that pins the right edge.
 */
const RIGHT = "start";

const text = (
  x: number,
  y: number,
  s: string,
  o: { size?: number; fill?: string; weight?: number; anchor?: string } = {},
) =>
  `<text x="${x}" y="${y}" text-anchor="${o.anchor ?? "middle"}" font-family="Vazirmatn" font-size="${o.size ?? 26}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.text}">${esc(s)}</text>`;

/** Wrapped lines, because a label that runs off the box teaches nothing. */
const lines = (
  x: number,
  y: number,
  parts: string[],
  o: Parameters<typeof text>[3] = {},
  lead = 34,
) => parts.map((p, i) => text(x, y + i * lead, p, o)).join("");

// ───────────────────────────────────────────────────────── who is involved ──

/**
 * The four parties and what actually passes between them.
 *
 * Shown once at the start of each video, from that panel's point of view: the
 * party whose panel it is sits lit, the others are context.
 */
export function partiesDiagram(focus: "merchant" | "foreign" | "admin" | "bank") {
  const W = 1700;
  const H = 820;
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    title: string,
    role: string[],
    on: boolean,
  ) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${color}" fill-opacity="${on ? 0.22 : 0.07}" stroke="${color}" stroke-width="${on ? 4 : 2}"/>` +
    text(x + w / 2, y + 54, title, { size: 32, weight: 700, fill: on ? C.text : C.mute }) +
    lines(x + w / 2, y + 104, role, { size: 24, fill: C.mute }, 32);

  const bw = 380;
  const bh = 200;
  const parts: string[] = [];

  parts.push(box(W - bw - 60, 60, bw, bh, C.merchant, "بازرگان ایرانی", ["کالا می‌فروشد یا می‌خرد"], focus === "merchant"));
  parts.push(box(60, 60, bw, bh, C.foreign, "طرف خارجی", ["می‌پردازد یا می‌فروشد"], focus === "foreign"));
  parts.push(box(W - bw - 60, H - bh - 60, bw, bh, C.admin, "سازمان منطقه آزاد", ["تأیید می‌کند و ناظر است"], focus === "admin"));
  parts.push(box(60, H - bh - 60, bw, bh, C.bank, "بانک عامل", ["ارز و ریال را جابه‌جا می‌کند"], focus === "bank"));

  // The gateway in the middle: everything passes through it.
  const cx = W / 2;
  const cy = H / 2;
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="128" fill="${C.chain}" fill-opacity="0.14" stroke="${C.chain}" stroke-width="3"/>`,
    text(cx, cy - 8, "سامانهٔ", { size: 30, weight: 700 }),
    text(cx, cy + 30, "پرداخت ارزی", { size: 30, weight: 700 }),
  );

  const link = (x1: number, y1: number, x2: number, y2: number, label: string, color: string) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-dasharray="8 10" opacity="0.8"/>` +
    `<rect x="${(x1 + x2) / 2 - 92}" y="${(y1 + y2) / 2 - 22}" width="184" height="44" rx="12" fill="#0b1220"/>` +
    text((x1 + x2) / 2, (y1 + y2) / 2 + 9, label, { size: 22, fill: C.mute });

  parts.unshift(
    link(W - bw - 90, 160, cx + 120, cy - 60, "فاکتور", C.merchant),
    link(bw + 90, 160, cx - 120, cy - 60, "ارز", C.foreign),
    link(W - bw - 90, H - 160, cx + 120, cy + 60, "تأیید", C.admin),
    link(bw + 90, H - 160, cx - 120, cy + 60, "ریال", C.bank),
  );

  return svg(W, H, parts.join(""));
}

// ──────────────────────────────────────────────────────────── where we are ──

export type Stage = { label: string; actor: keyof typeof C };

/**
 * The path as a numbered ladder, with one rung lit.
 *
 * Vertical rather than horizontal: a trade has eight or nine steps and a row of
 * nine is unreadable on a projector, while a column reads like a checklist —
 * which is what it is.
 */
export function ladderDiagram(stages: Stage[], active: number, title: string) {
  const W = 1560;
  const rowH = 78;
  const H = stages.length * rowH + 130;
  const parts: string[] = [];

  parts.push(text(W - 40, 54, title, { size: 30, weight: 700, anchor: RIGHT, fill: C.mute }));

  stages.forEach((s, i) => {
    const y = 120 + i * rowH;
    const color = C[s.actor] ?? C.dim;
    const done = i < active;
    const on = i === active;
    const x = W - 70;

    if (i < stages.length - 1) {
      parts.push(
        `<line x1="${x - 30}" y1="${y + 16}" x2="${x - 30}" y2="${y + rowH - 16}" stroke="${done ? color : C.dim}" stroke-width="3" ${done || on ? "" : 'stroke-dasharray="5 8"'}/>`,
      );
    }
    parts.push(
      `<circle cx="${x - 30}" cy="${y}" r="${on ? 26 : 20}" fill="${done || on ? color : "none"}" fill-opacity="${on ? 1 : done ? 0.35 : 0}" stroke="${done || on ? color : C.dim}" stroke-width="3"/>`,
      text(x - 30, y + (on ? 10 : 8), fa(i + 1), {
        size: on ? 26 : 21,
        weight: 700,
        fill: on ? "#0b1120" : done || on ? color : C.dim,
      }),
      text(x - 76, y + 11, s.label, {
        size: on ? 32 : 27,
        weight: on ? 600 : 400,
        anchor: RIGHT,
        fill: on ? C.text : done ? C.mute : "#5c6a86",
      }),
    );
    if (on) {
      parts.push(
        `<rect x="40" y="${y - 30}" width="${W - 80}" height="60" rx="14" fill="${color}" fill-opacity="0.09"/>`,
      );
    }
  });

  // The highlight band has to sit behind the text it highlights.
  const band = parts.filter((p) => p.startsWith("<rect x=\"40\""));
  const rest = parts.filter((p) => !p.startsWith("<rect x=\"40\""));
  return svg(W, H, band.join("") + rest.join(""));
}

// ─────────────────────────────────────────────────────────────── the split ──

/**
 * One payment becoming three, drawn to scale.
 *
 * The fee is two percent, so a pie of it is a sliver nobody can read. A bar
 * broken into its parts, with the small ones called out, says the same thing
 * and stays honest about the proportions.
 */
export function splitDiagram(total: number, fee: number, freezoneShare: number) {
  const W = 1640;
  const H = 620;
  const gateway = (fee * (100 - freezoneShare)) / 100;
  const freezone = (fee * freezoneShare) / 100;
  const net = total - fee;

  const barY = 210;
  const barH = 128;
  const barX = 80;
  const barW = W - 160;
  const w = (v: number) => (v / total) * barW;
  // The two fee slices are a sliver at true scale; drawn at a floor so they can
  // be seen, with the real figures printed on them so nothing is overstated.
  const minW = 118;
  const gw = Math.max(minW, w(gateway));
  const fw = Math.max(minW, w(freezone));
  const nw = barW - gw - fw;

  const parts: string[] = [];
  parts.push(text(W - 80, 96, `پرداخت خریدار: ${fa(total.toLocaleString("en-US"))} تتر`, { size: 34, weight: 700, anchor: RIGHT }));
  parts.push(text(W - 80, 144, `کارمزد درگاه ${fa(2)}٪ — بقیه به فروشنده`, { size: 25, anchor: RIGHT, fill: C.mute }));

  // Right to left: the seller's share starts at the right.
  let x = barX + barW;
  const slice = (width: number, color: string, label: string, amount: number) => {
    x -= width;
    parts.push(
      `<rect x="${x}" y="${barY}" width="${width}" height="${barH}" rx="10" fill="${color}" fill-opacity="0.85"/>`,
      text(x + width / 2, barY + barH / 2 + 4, fa(amount.toLocaleString("en-US")), {
        size: 30,
        weight: 700,
        fill: "#0b1120",
      }),
      text(x + width / 2, barY + barH + 46, label, { size: 25, fill: C.mute }),
    );
  };
  slice(nw, C.bank, "به فروشنده / خزانهٔ بانک", net);
  slice(gw, C.chain, "کارمزد درگاه", gateway);
  slice(fw, C.admin, "سهم سازمان", freezone);

  parts.push(
    text(W / 2, H - 66, "این تقسیم را قرارداد انجام می‌دهد، در همان یک تراکنش.", {
      size: 27,
      fill: C.text,
    }),
    text(W / 2, H - 24, "مقصدها در نشانی واریز قفل شده‌اند و قابل تغییر نیستند.", {
      size: 24,
      fill: C.mute,
    }),
  );
  return svg(W, H, parts.join(""));
}

// ─────────────────────────────────────────────────── how an address is made ──

/** Why a deposit address can be trusted before anyone has signed anything. */
export function addressDiagram() {
  const W = 1660;
  const H = 700;
  const parts: string[] = [];

  const chip = (x: number, y: number, w: number, label: string, value: string, color: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="86" rx="14" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2"/>` +
    text(x + w / 2, y + 34, label, { size: 21, fill: C.mute }) +
    text(x + w / 2, y + 66, value, { size: 25, weight: 600 });

  const cw = 330;
  const gap = 26;
  const startX = W - 60 - cw;
  const terms = [
    ["شمارهٔ فاکتور", "INV-1044", C.merchant],
    ["کارمزد", "۲٪ — کف ۱", C.chain],
    ["سهم سازمان", "۵۰٪ از کارمزد", C.admin],
    ["مقصد فروشنده", "کیف پول ثبت‌شده", C.bank],
  ] as const;

  terms.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    parts.push(chip(startX - col * (cw + gap), 90 + row * 112, cw, t[0], t[1], t[2]));
  });

  parts.push(
    text(W - 60, 60, "شرایطی که در نشانی قفل می‌شود", { size: 28, weight: 700, anchor: RIGHT, fill: C.mute }),
  );

  // The arrow into the address.
  parts.push(
    `<path d="M ${startX - cw - gap - 40} 200 H 560" stroke="${C.chain}" stroke-width="3" stroke-dasharray="8 10"/>`,
    `<path d="M 560 200 l 26 -12 v 24 z" fill="${C.chain}"/>`,
  );

  parts.push(
    `<rect x="60" y="120" width="470" height="160" rx="18" fill="${C.chain}" fill-opacity="0.16" stroke="${C.chain}" stroke-width="3"/>`,
    text(295, 172, "نشانی واریز", { size: 27, weight: 700 }),
    text(295, 216, "0xC04E…B6E7", { size: 26, fill: C.chain }),
    text(295, 254, "فقط برای همین فاکتور", { size: 21, fill: C.mute }),
  );

  parts.push(
    lines(
      W / 2,
      H - 190,
      [
        "نشانی از روی همین شرایط ساخته می‌شود — پیش از آنکه کسی چیزی امضا کند.",
        "اگر شرایط عوض شود، نشانی هم عوض می‌شود؛ پس نمی‌توان بعداً مقصد را جابه‌جا کرد.",
        "هیچ کلید خصوصی‌ای برای این نشانی در سامانه وجود ندارد.",
      ],
      { size: 27 },
      46,
    ),
  );
  return svg(W, H, parts.join(""));
}

// ───────────────────────────────────────────────────────────── the two legs ──

/** Export and import, side by side — which way the goods and the money go. */
export function directionsDiagram(focus: "EXPORT" | "IMPORT" | "both") {
  const W = 1680;
  const H = 560;
  const parts: string[] = [];

  const panel = (x: number, w: number, title: string, rows: [string, string][], color: string, on: boolean) => {
    const out: string[] = [
      `<rect x="${x}" y="70" width="${w}" height="${H - 120}" rx="20" fill="${color}" fill-opacity="${on ? 0.14 : 0.05}" stroke="${color}" stroke-width="${on ? 4 : 2}"/>`,
      text(x + w / 2, 132, title, { size: 36, weight: 700, fill: on ? C.text : C.mute }),
    ];
    rows.forEach(([k, v], i) => {
      const y = 216 + i * 104;
      out.push(
        text(x + w / 2, y, k, { size: 24, fill: C.mute }),
        text(x + w / 2, y + 42, v, { size: 29, weight: 500, fill: on ? C.text : C.mute }),
      );
    });
    return out.join("");
  };

  const pw = (W - 180) / 2;
  parts.push(
    panel(W - 60 - pw, pw, "صادرات", [
      ["کالا", "از منطقه آزاد به خارج"],
      ["پول", "ارز از خریدار خارجی می‌آید"],
      ["بازرگان", "ریالش را از بانک می‌گیرد"],
    ], C.merchant, focus !== "IMPORT"),
    panel(60, pw, "واردات", [
      ["کالا", "از خارج به منطقه آزاد"],
      ["پول", "بازرگان ریال می‌پردازد"],
      ["فروشنده", "ارزش را بانک می‌فرستد"],
    ], C.foreign, focus !== "EXPORT"),
  );
  return svg(W, H, parts.join(""));
}

// ────────────────────────────────────────────────────────── what a status is ──

/** The badges a screen shows, and what each one actually means. */
export function statusDiagram(rows: [string, string, string][], title: string) {
  const W = 1620;
  const H = rows.length * 108 + 190;
  const parts: string[] = [
    text(W - 60, 66, title, { size: 30, weight: 700, anchor: RIGHT, fill: C.mute }),
  ];
  rows.forEach(([badge, color, meaning], i) => {
    const y = 130 + i * 108;
    const bw = 340;
    parts.push(
      `<rect x="${W - 60 - bw}" y="${y}" width="${bw}" height="64" rx="32" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>`,
      text(W - 60 - bw / 2, y + 42, badge, { size: 27, weight: 600, fill: C.text }),
      text(W - 60 - bw - 50, y + 42, meaning, { size: 27, anchor: RIGHT, fill: C.mute }),
    );
  });
  return svg(W, H, parts.join(""));
}

// ────────────────────────────────────────────────────────── calling it off ──

/** What happens to the money when an import is cancelled. */
export function cancelDiagram() {
  const W = 1640;
  const H = 620;
  const parts: string[] = [];

  const step = (x: number, w: number, n: number, title: string, body: string[], color: string) =>
    `<rect x="${x}" y="150" width="${w}" height="290" rx="18" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2.5"/>` +
    `<circle cx="${x + w / 2}" cy="150" r="30" fill="${color}"/>` +
    text(x + w / 2, 160, fa(n), { size: 28, weight: 700, fill: "#0b1120" }) +
    text(x + w / 2, 232, title, { size: 30, weight: 700 }) +
    lines(x + w / 2, 288, body, { size: 24, fill: C.mute }, 38);

  const w = 460;
  const gap = 60;
  parts.push(
    text(W - 60, 76, "اگر معامله به‌هم بخورد و ریال نزد بانک باشد", { size: 30, weight: 700, anchor: RIGHT, fill: C.mute }),
    step(W - 60 - w, w, 1, "درخواست لغو", ["بازرگان لغو را", "درخواست می‌کند"], C.merchant),
    step(W - 60 - w * 2 - gap, w, 2, "در حال لغو", ["سازمان یا بانک", "می‌پذیرد — ریال", "هنوز برنگشته"], C.admin),
    step(60, w, 3, "لغو شد", ["بانک ریال را", "برمی‌گرداند و", "رسید ثبت می‌شود"], C.bank),
  );
  parts.push(
    text(W / 2, H - 40, "«در حال لغو» مرحله‌ای است که نمی‌شود از آن پرید — تا ریال برنگردد، فاکتور بسته نمی‌شود.", {
      size: 25,
      fill: C.text,
    }),
  );
  return svg(W, H, parts.join(""));
}
