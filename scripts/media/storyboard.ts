import type { PanelKey } from "./content";
import type { Shot } from "./capture";
import {
  addressDiagram,
  cancelDiagram,
  directionsDiagram,
  ladderDiagram,
  partiesDiagram,
  splitDiagram,
  statusDiagram,
  type Stage,
} from "./diagrams";

/**
 * The complete path each panel walks, start to finish.
 *
 * Two earlier attempts got this wrong in opposite directions. The first was
 * nine minutes of paragraphs over a single diagram — a document read aloud. The
 * second was a tour of the menu: here is the exports page, here is the wallets
 * page, which shows a viewer where things are without ever telling them what
 * happens.
 *
 * This is the trade itself, step by numbered step. Every step is a pair: the
 * drawing that explains it, then the real screen with the part being described
 * ringed on it. Nothing is skipped between the first step and the last, because
 * the gaps are where somebody who does not know the system gets lost — the rial
 * leg of an export is five steps, and the last version covered it in one
 * sentence.
 */
export type Beat =
  | { kind: "title"; heading: string; sub?: string; seconds?: number }
  | { kind: "shot"; shot: string; caption: string; step?: string; seconds?: number }
  | { kind: "diagram"; svg: string; caption: string; step?: string; seconds?: number };

/** Read at an unhurried pace, with a floor so a short caption still lands. */
export function beatSeconds(beat: Beat): number {
  if (beat.seconds) return beat.seconds;
  if (beat.kind === "title") return 4;
  const words = beat.caption.trim().split(/\s+/).length;
  const base = beat.kind === "diagram" ? 3.4 : 2.6;
  return Math.round(Math.min(11, Math.max(4, base + words / 2.3)));
}

// ────────────────────────────────────────────────────────── the real paths ──

/**
 * Read out of `app/api/invoices/[ref]/transition/route.ts` and its settlement
 * counterpart rather than remembered. Each entry is a status the record really
 * sits in, and the actor named is the only role the route lets move it on.
 */
const EXPORT_STAGES: Stage[] = [
  { label: "بازرگان فاکتور صادر می‌کند", actor: "merchant" },
  { label: "سازمان تأیید می‌کند", actor: "admin" },
  { label: "نشانی واریز ساخته می‌شود", actor: "chain" },
  { label: "خریدار خارجی ارز می‌فرستد", actor: "foreign" },
  { label: "شبکه پرداخت را قطعی می‌کند", actor: "chain" },
  { label: "قرارداد مبلغ را تقسیم می‌کند", actor: "chain" },
  { label: "درخواست تسویهٔ ریالی ساخته می‌شود", actor: "bank" },
];

const SETTLE_STAGES: Stage[] = [
  { label: "بازرگان شمارهٔ حساب می‌دهد", actor: "merchant" },
  { label: "سازمان تسویه را تأیید می‌کند", actor: "admin" },
  { label: "بانک نرخ را قفل می‌کند", actor: "bank" },
  { label: "بانک ریال را واریز می‌کند", actor: "bank" },
  { label: "تسویه بسته می‌شود", actor: "bank" },
];

const IMPORT_STAGES: Stage[] = [
  // The route picks the role from the direction: whoever is owed the money
  // raises the invoice. Importing, that is the foreign seller — not the
  // importer, which is what the first cut of this said.
  { label: "فروشندهٔ خارجی فاکتور صادر می‌کند", actor: "foreign" },
  { label: "سازمان تأیید می‌کند", actor: "admin" },
  { label: "بانک نرخ و حساب ریالی را اعلام می‌کند", actor: "bank" },
  { label: "بازرگان ریال را واریز می‌کند", actor: "merchant" },
  { label: "بانک دریافت ریال را تأیید می‌کند", actor: "bank" },
  { label: "بانک ارز را به نشانی قرارداد می‌فرستد", actor: "bank" },
  { label: "قرارداد ارز را به فروشندهٔ خارجی می‌دهد", actor: "chain" },
];

// ───────────────────────────────────────────────────────────────── shots ──

const listClip = { x: 0, y: 0, w: 1, h: 0.62 };
const fullish = { x: 0, y: 0, w: 1, h: 0.8 };

export const SHOTS: Shot[] = [
  // ── the Iranian merchant
  { name: "u-dash", as: "merchant", path: "/dashboard", clip: fullish, ring: "nav" },
  { name: "u-exports", as: "merchant", path: "/receive", clip: listClip, ring: "text=ایجاد فاکتور جدید" },
  {
    name: "u-export-new",
    as: "merchant",
    path: "/receive",
    click: ["text=ایجاد فاکتور جدید"],
    fill: [
      ["#counterpartyUid", "FOR-201"],
      ["#goodsTitle", "فرش دستباف ۶ متری"],
      ["#amount", "12500"],
      ["#description", "صادرات به ترکیه — قرارداد ۸۸۲"],
    ],
    clipTo: '[role="dialog"]',
    wait: 1800,
  },
  { name: "u-exports-status", as: "merchant", path: "/receive", clip: listClip, ring: "tbody tr:nth-child(1)" },
  { name: "u-export-detail", as: "merchant", path: "/receive/INV-1044", clip: fullish, wait: 1800 },
  { name: "u-settlement", as: "merchant", path: "/settlement", clip: listClip },
  { name: "u-settlement-row", as: "merchant", path: "/settlement", clip: listClip, ring: "tbody tr:nth-child(1)" },
  { name: "u-imports", as: "merchant", path: "/imports", clip: { x: 0, y: 0, w: 1, h: 0.72 } },
  { name: "u-wallets", as: "merchant", path: "/wallets", clip: listClip },
  { name: "u-reports", as: "merchant", path: "/reports", clip: fullish },

  // ── the foreign buyer
  { name: "f-dash", as: "foreign", path: "/foreign/dashboard", clip: fullish },
  { name: "f-invoices", as: "foreign", path: "/foreign/invoices", clip: listClip, ring: "tbody tr:nth-child(1)" },
  { name: "f-pay", as: "foreign", path: "/pay/INV-1050", clipTo: ".max-w-md", wait: 2200 },
  { name: "f-pay-amount", as: "foreign", path: "/pay/INV-1050", clipTo: ".max-w-md", ring: "text=Amount due", wait: 2200 },
  { name: "f-pay-address", as: "foreign", path: "/pay/INV-1050", clipTo: ".max-w-md", ring: "code", wait: 2200 },
  { name: "f-wallets", as: "foreign", path: "/foreign/wallets", clip: listClip },
  { name: "f-reports", as: "foreign", path: "/foreign/reports", clip: fullish },

  // ── the organisation
  { name: "a-dash", as: "admin", path: "/admin/dashboard", clip: fullish },
  { name: "a-kyc", as: "admin", path: "/admin/kyc", clip: listClip, ring: "tbody tr:nth-child(1)" },
  { name: "a-invoices", as: "admin", path: "/admin/invoices", click: ["text=همه"], clip: listClip },
  {
    name: "a-invoice-review",
    as: "admin",
    path: "/admin/invoices",
    click: ["text=همه", "tbody tr:nth-child(1) >> text=بررسی"],
    clipTo: '[role="dialog"]',
    wait: 1800,
  },
  { name: "a-settlements", as: "admin", path: "/admin/settlements", click: ["text=همه"], clip: listClip },
  { name: "a-transactions", as: "admin", path: "/admin/transactions", clip: listClip },
  { name: "a-ledger", as: "admin", path: "/admin/ledger", clip: fullish },
  { name: "a-reports", as: "admin", path: "/admin/reports", clip: fullish },
  { name: "a-users", as: "admin", path: "/admin/users", clip: listClip },

  // ── the bank
  { name: "b-dash", as: "bank", path: "/bank/dashboard", clip: fullish },
  { name: "b-imports-rate", as: "bank", path: "/bank/imports", clip: { x: 0, y: 0, w: 1, h: 0.58 }, ring: "text=قفل نرخ" },
  { name: "b-imports-rial", as: "bank", path: "/bank/imports", clip: { x: 0, y: 0.2, w: 1, h: 0.58 }, ring: "text=تأیید دریافت ریال" },
  { name: "b-settlement", as: "bank", path: "/bank/settlement", clip: listClip },
  { name: "b-deposits", as: "bank", path: "/bank/deposits", clip: listClip },
  { name: "b-deposits-split", as: "bank", path: "/bank/deposits", clip: listClip, ring: "tbody tr:nth-child(1)" },
  { name: "b-wallets", as: "bank", path: "/bank/wallets", clip: listClip },
  { name: "b-reports", as: "bank", path: "/bank/reports", clip: fullish },
];

// ─────────────────────────────────────────────────────────────── the videos ──

/** Persian digits, like every other number the system puts on a screen. */
const fa = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
const step = (n: number, of: number) => `گام ${fa(n)} از ${fa(of)}`;

const STATUS_ROWS: [string, string, string][] = [
  ["در انتظار تأیید", "#94a3b8", "هنوز سازمان تصمیم نگرفته"],
  ["تأیید شده — منتظر پرداخت", "#38bdf8", "نشانی ساخته شد؛ منتظر خریدار"],
  ["منتظر پرداخت", "#f0abfc", "بخشی رسیده، بقیه نه"],
  ["موفق — واریز شد", "#34d399", "پرداخت روی شبکه قطعی شد"],
];

const USER_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بازرگان داخلی", sub: "راهنمای گام‌به‌گام — سامانهٔ پرداخت ارزی منطقه آزاد" },
  { kind: "diagram", svg: partiesDiagram("merchant"), caption: "چهار طرف در سامانه هستند. شما بازرگان ایرانی هستید." },
  { kind: "diagram", svg: directionsDiagram("both"), caption: "دو مسیر دارید: صادرات، که ارز به شما می‌رسد — و واردات، که ریال می‌پردازید." },
  { kind: "shot", shot: "u-dash", caption: "منوی سمت راست همهٔ کارهای شماست. با صادرات شروع می‌کنیم." },

  { kind: "title", heading: "مسیر یکم: صادرات", sub: "از صدور فاکتور تا رسیدن ریال به حساب شما" },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 0, "مسیر صادرات"), step: step(1, 7), caption: "شما فاکتور را برای خریدار خارجی صادر می‌کنید." },
  { kind: "shot", shot: "u-exports", step: step(1, 7), caption: "در صفحهٔ «صادرات»، دکمهٔ «ایجاد فاکتور جدید»." },
  { kind: "shot", shot: "u-export-new", step: step(1, 7), caption: "شناسهٔ خریدار، شرح کالا، و مبلغ. خریدار باید از پیش ثبت‌نام کرده باشد." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 1, "مسیر صادرات"), step: step(2, 7), caption: "فاکتور به سازمان می‌رود. تا تأیید نشود، پیش نمی‌رود." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 2, "مسیر صادرات"), step: step(3, 7), caption: "پس از تأیید، سامانه یک نشانی واریز فقط برای همین فاکتور می‌سازد." },
  { kind: "diagram", svg: addressDiagram(), step: step(3, 7), caption: "نشانی از روی شرایط فاکتور ساخته می‌شود — پس مقصد پول قابل دستکاری نیست." },
  { kind: "shot", shot: "u-export-detail", step: step(3, 7), caption: "همین نشانی در صفحهٔ فاکتور به شما نشان داده می‌شود." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 3, "مسیر صادرات"), step: step(4, 7), caption: "خریدار خارجی ارز را به همان نشانی می‌فرستد." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 4, "مسیر صادرات"), step: step(5, 7), caption: "سامانه خودش روی شبکه می‌بیند. تا قطعی نشود، وضعیت عوض نمی‌شود." },
  { kind: "diagram", svg: statusDiagram(STATUS_ROWS, "وضعیت‌هایی که در فهرست می‌بینید"), step: step(5, 7), caption: "این چهار وضعیت را در فهرست صادرات می‌بینید." },
  { kind: "shot", shot: "u-exports-status", step: step(5, 7), caption: "وضعیت هر فاکتور در همین ستون است و خودبه‌خود عوض می‌شود." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 5, "مسیر صادرات"), step: step(6, 7), caption: "قرارداد مبلغ را در همان یک تراکنش تقسیم می‌کند." },
  { kind: "diagram", svg: splitDiagram(12500, 250, 50), step: step(6, 7), caption: "کارمزد درگاه دو درصد است و نیمش سهم سازمان. بقیه سهم شماست." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 6, "مسیر صادرات"), step: step(7, 7), caption: "سامانه خودش یک درخواست تسویهٔ ریالی برای شما می‌سازد." },

  { kind: "title", heading: "تسویهٔ ریالی", sub: "پنج گام تا رسیدن پول به حساب بانکی شما" },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 0, "مسیر تسویه"), step: step(1, 5), caption: "اول شمارهٔ حساب ریالی خود را ثبت می‌کنید." },
  { kind: "shot", shot: "u-settlement", step: step(1, 5), caption: "صفحهٔ «تسویه ریالی» — هر تسویه یک ردیف است." },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 1, "مسیر تسویه"), step: step(2, 5), caption: "سازمان تسویه را تأیید می‌کند و آن را به بانک می‌سپارد." },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 2, "مسیر تسویه"), step: step(3, 5), caption: "بانک نرخ روز را قفل می‌کند — از آن لحظه نرخ تغییر نمی‌کند." },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 3, "مسیر تسویه"), step: step(4, 5), caption: "بانک ریال را به حساب شما واریز می‌کند." },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 4, "مسیر تسویه"), step: step(5, 5), caption: "تسویه بسته می‌شود. مسیر صادرات اینجا تمام است." },
  { kind: "shot", shot: "u-settlement-row", step: step(5, 5), caption: "مبلغ ریالی، نرخ، و تاریخ واریز — همه در همین ردیف." },

  { kind: "title", heading: "مسیر دوم: واردات", sub: "از ثبت فاکتور فروشنده تا رسیدن ارز به او" },
  { kind: "diagram", svg: directionsDiagram("IMPORT"), caption: "اینجا برعکس است: کالا می‌آید و شما ریال می‌پردازید." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 0, "مسیر واردات"), step: step(1, 7), caption: "فروشندهٔ خارجی فاکتور را صادر می‌کند و به نام شما ثبت می‌شود." },
  { kind: "shot", shot: "u-imports", step: step(1, 7), caption: "صفحهٔ «واردات» — فاکتورهایی که باید ریالشان را بپردازید." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 1, "مسیر واردات"), step: step(2, 7), caption: "سازمان آن را هم تأیید می‌کند." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 2, "مسیر واردات"), step: step(3, 7), caption: "بانک نرخ را اعلام و شمارهٔ حساب ریالی را می‌دهد." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 3, "مسیر واردات"), step: step(4, 7), caption: "شما ریال را به همان حساب واریز می‌کنید." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 4, "مسیر واردات"), step: step(5, 7), caption: "بانک دریافت ریال را تأیید می‌کند." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 5, "مسیر واردات"), step: step(6, 7), caption: "بانک ارز را به نشانی قرارداد می‌فرستد." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 6, "مسیر واردات"), step: step(7, 7), caption: "قرارداد ارز را به فروشندهٔ خارجی می‌رساند. واردات تمام است." },
  { kind: "diagram", svg: cancelDiagram(), caption: "و اگر معامله به‌هم بخورد، مسیر لغو سه گام دارد و ریال شما برمی‌گردد." },

  { kind: "shot", shot: "u-wallets", caption: "«مدیریت والت»: کیف پول‌هایی که به نام شما ثبت شده‌اند." },
  { kind: "shot", shot: "u-reports", caption: "«گزارشات»: سابقهٔ کامل، با خروجی اکسل." },
  { kind: "title", heading: "پایان راهنما", sub: "پنل بازرگان داخلی — سامانهٔ پرداخت ارزی منطقه آزاد" },
];

const FOREIGN_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بازرگان خارجی", sub: "راهنمای گام‌به‌گام — سامانهٔ پرداخت ارزی منطقه آزاد" },
  { kind: "diagram", svg: partiesDiagram("foreign"), caption: "شما طرف خارجی هستید: یا می‌پردازید، یا کالا می‌فروشید." },
  { kind: "diagram", svg: directionsDiagram("EXPORT"), caption: "در حالت رایج، بازرگان ایرانی می‌فروشد و شما ارزش را می‌پردازید." },
  { kind: "shot", shot: "f-dash", caption: "داشبورد شما: چه چیزی منتظر پرداخت است و چه چیزی پرداخت شده." },

  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 0, "مسیر پرداخت"), step: step(1, 5), caption: "فروشندهٔ ایرانی فاکتوری به نام شما صادر می‌کند." },
  { kind: "shot", shot: "f-invoices", step: step(1, 5), caption: "فاکتور در فهرست شما ظاهر می‌شود." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 2, "مسیر پرداخت"), step: step(2, 5), caption: "پس از تأیید سازمان، یک نشانی واریز فقط برای همین فاکتور ساخته می‌شود." },
  { kind: "diagram", svg: addressDiagram(), step: step(2, 5), caption: "مقصد پول در همان نشانی قفل است و بعداً قابل تغییر نیست." },
  { kind: "shot", shot: "f-pay", step: step(3, 5), caption: "صفحهٔ پرداخت را باز می‌کنید." },
  { kind: "shot", shot: "f-pay-amount", step: step(3, 5), caption: "مبلغ و مهلت پرداخت، بالای صفحه." },
  { kind: "shot", shot: "f-pay-address", step: step(3, 5), caption: "نشانی و QR. ارز را روی همان شبکه به همین نشانی بفرستید." },
  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 4, "مسیر پرداخت"), step: step(4, 5), caption: "سامانه پرداخت را روی شبکه می‌بیند. کار دیگری از شما لازم نیست." },
  { kind: "diagram", svg: splitDiagram(2600, 52, 50), step: step(5, 5), caption: "قرارداد مبلغ را تقسیم می‌کند: فروشنده، درگاه، سازمان." },
  { kind: "shot", shot: "f-dash", step: step(5, 5), caption: "وضعیت در داشبورد شما به «پرداخت‌شده» تغییر می‌کند." },

  { kind: "shot", shot: "f-wallets", caption: "«کیف پول»: نشانی‌هایی که به نام شما ثبت شده." },
  { kind: "shot", shot: "f-reports", caption: "«گزارشات»: سابقهٔ کامل پرداخت‌های شما." },
  { kind: "title", heading: "پایان راهنما", sub: "پنل بازرگان خارجی — سامانهٔ پرداخت ارزی منطقه آزاد" },
];

const ADMIN_BEATS: Beat[] = [
  { kind: "title", heading: "پنل سازمان منطقه آزاد", sub: "راهنمای گام‌به‌گام — نظارت بر کل سامانه" },
  { kind: "diagram", svg: partiesDiagram("admin"), caption: "سازمان ناظر است: تأیید می‌کند، می‌بیند، و سهم خود را دریافت می‌کند." },
  { kind: "shot", shot: "a-dash", caption: "داشبورد: آنچه در انتظار تصمیم شماست، در یک نگاه." },

  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 1, "جایگاه سازمان در مسیر"), step: step(1, 4), caption: "کار اول: احراز هویت. هیچ‌کس بدون تأیید شما وارد تجارت نمی‌شود." },
  { kind: "shot", shot: "a-kyc", step: step(1, 4), caption: "هر درخواست ثبت‌نام اینجا منتظر تصمیم شماست." },
  { kind: "shot", shot: "a-users", step: step(1, 4), caption: "و «کاربران» نشان می‌دهد چه کسی با چه نقشی در سامانه است." },

  { kind: "diagram", svg: ladderDiagram(EXPORT_STAGES, 1, "جایگاه سازمان در مسیر"), step: step(2, 4), caption: "کار دوم: تأیید فاکتور. تا تأیید نشود، نشانی واریز ساخته نمی‌شود." },
  { kind: "shot", shot: "a-invoices", step: step(2, 4), caption: "همهٔ فاکتورها، با جهت صادرات یا واردات." },
  { kind: "shot", shot: "a-invoice-review", step: step(2, 4), caption: "تأیید یا رد — و رد همیشه دلیل می‌خواهد." },

  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 1, "جایگاه سازمان در تسویه"), step: step(3, 4), caption: "کار سوم: تأیید تسویه، پیش از آنکه به بانک برسد." },
  { kind: "shot", shot: "a-settlements", step: step(3, 4), caption: "درخواست‌های تسویهٔ ریالی بازرگانان." },

  { kind: "diagram", svg: splitDiagram(12500, 250, 50), step: step(4, 4), caption: "کار چهارم: نظارت. سهم سازمان از هر پرداخت، روی زنجیره تقسیم می‌شود." },
  { kind: "shot", shot: "a-transactions", step: step(4, 4), caption: "«تراکنش‌ها»: هر پرداختی که سامانه روی شبکه دیده است." },
  { kind: "shot", shot: "a-ledger", step: step(4, 4), caption: "«دفتر کل»: هر واحد ارز در یک حساب — طلب بازرگان، سهم درگاه، سهم سازمان." },
  { kind: "shot", shot: "a-reports", step: step(4, 4), caption: "«گزارشات»: حجم، توزیع ارز، و روند ماهانه." },
  { kind: "diagram", svg: cancelDiagram(), caption: "و اگر واردات لغو شود، سازمان یکی از دو طرفی است که می‌تواند آن را بپذیرد." },
  { kind: "title", heading: "پایان راهنما", sub: "پنل سازمان منطقه آزاد — سامانهٔ پرداخت ارزی" },
];

const BANK_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بانک عامل", sub: "راهنمای گام‌به‌گام — نقش صرافی سامانه" },
  { kind: "diagram", svg: partiesDiagram("bank"), caption: "بانک صرافی سامانه است: ارز می‌دهد و ریال می‌گیرد، و برعکس." },
  { kind: "shot", shot: "b-dash", caption: "داشبورد: دو صف در انتظار بانک — واردات و تسویه." },

  { kind: "title", heading: "کار یکم: واردات", sub: "بانک ارز را برای فروشندهٔ خارجی تأمین می‌کند" },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 2, "مسیر واردات"), step: step(1, 4), caption: "بانک نرخ روز را قفل و شمارهٔ حساب ریالی را اعلام می‌کند." },
  { kind: "shot", shot: "b-imports-rate", step: step(1, 4), caption: "نرخ را وارد و «قفل نرخ» را می‌زنید." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 4, "مسیر واردات"), step: step(2, 4), caption: "پس از واریز بازرگان، دریافت ریال را تأیید می‌کنید." },
  { kind: "shot", shot: "b-imports-rial", step: step(2, 4), caption: "شمارهٔ رسید را ثبت و «تأیید دریافت ریال» را می‌زنید." },
  { kind: "diagram", svg: ladderDiagram(IMPORT_STAGES, 5, "مسیر واردات"), step: step(3, 4), caption: "بعد ارز را به نشانی قرارداد می‌فرستید." },
  { kind: "shot", shot: "b-deposits", step: step(3, 4), caption: "«آدرس‌های واریز»: ارزی که رسیده و هنوز تقسیم نشده." },
  { kind: "diagram", svg: splitDiagram(15000, 300, 50), step: step(4, 4), caption: "قرارداد تقسیم می‌کند — مقصدها از پیش قفل شده‌اند." },
  { kind: "shot", shot: "b-deposits-split", step: step(4, 4), caption: "پیش‌بینی تقسیم، پیش از آنکه انجام شود." },

  { kind: "title", heading: "کار دوم: تسویهٔ ریالی", sub: "بانک ریال صادرکننده را می‌پردازد" },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 2, "مسیر تسویه"), step: step(1, 2), caption: "نرخ را قفل می‌کنید — از آن لحظه نرخ تغییر نمی‌کند." },
  { kind: "diagram", svg: ladderDiagram(SETTLE_STAGES, 3, "مسیر تسویه"), step: step(2, 2), caption: "و ریال را به حساب بازرگان واریز می‌کنید." },
  { kind: "shot", shot: "b-settlement", step: step(2, 2), caption: "صف تسویه: بازرگانانی که منتظر ریال هستند." },

  { kind: "shot", shot: "b-wallets", caption: "«کیف پول‌های بانک»: موجودی ارزی، در لحظه." },
  { kind: "shot", shot: "b-reports", caption: "«گزارشات»: جریان ارز و ریال، ماه به ماه." },
  { kind: "diagram", svg: cancelDiagram(), caption: "و اگر واردات لغو شود، بازگرداندن ریال کار بانک است." },
  { kind: "title", heading: "پایان راهنما", sub: "پنل بانک عامل — سامانهٔ پرداخت ارزی منطقه آزاد" },
];

export const BEATS: Record<PanelKey, Beat[]> = {
  user: USER_BEATS,
  foreign: FOREIGN_BEATS,
  admin: ADMIN_BEATS,
  bank: BANK_BEATS,
};

export const runtimeOf = (key: PanelKey) =>
  BEATS[key].reduce((total, beat) => total + beatSeconds(beat), 0);
