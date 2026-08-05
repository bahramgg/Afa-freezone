import type { Flow, PanelKey } from "./content";
import { EXPORT_FLOW, IMPORT_FLOW } from "./content";
import type { Shot } from "./capture";

/**
 * What each video shows, in order.
 *
 * The first guides were slides — a paragraph of Persian over a diagram, twelve
 * seconds a time, nine minutes a panel. They described screens the viewer had
 * never been shown, at a pace that assumed they were studying rather than
 * watching, and they were the same four videos with the panel's name swapped.
 *
 * These are built the other way round. The screen is the content and the words
 * are a caption: one line, read in the time it takes to look at what it points
 * at. Nothing is explained that is not on screen at that moment, each video
 * covers its own panel and nothing else, and a diagram appears only where the
 * money goes somewhere a screenshot cannot show.
 *
 * Aimed at somebody who has not been told what the system is for.
 */
export type Beat =
  /** Full-bleed title card. Used once at each end. */
  | { kind: "title"; heading: string; sub?: string; seconds?: number }
  /** A real screen, with one line about it. */
  | { kind: "shot"; shot: string; caption: string; seconds?: number }
  /** Where the money goes. One node lit at a time. */
  | { kind: "flow"; flow: Flow; active?: number; caption: string; seconds?: number };

/** A caption is read in about this many seconds, and never dwelt on. */
export function beatSeconds(beat: Beat): number {
  if (beat.seconds) return beat.seconds;
  const words = (t?: string) => (t ? t.trim().split(/\s+/).length : 0);
  if (beat.kind === "title") return 3;
  // Roughly three words a second, which is a glance rather than a study, with
  // a floor so a very short caption still lands and a ceiling so none drags.
  const read = words(beat.caption) / 2.4;
  const base = beat.kind === "flow" ? 3.2 : 2.4;
  return Math.round(Math.min(9, Math.max(4, base + read)));
}

// ───────────────────────────────────────────────────────────────── shots ──

const listClip = { x: 0, y: 0, w: 1, h: 0.62 };
const topClip = { x: 0, y: 0, w: 1, h: 0.46 };
const fullish = { x: 0, y: 0, w: 1, h: 0.8 };

export const SHOTS: Shot[] = [
  // ── the Iranian merchant
  { name: "u-dash", as: "merchant", path: "/dashboard", clip: fullish },
  { name: "u-dash-cards", as: "merchant", path: "/dashboard", clip: topClip },
  { name: "u-exports", as: "merchant", path: "/receive", clip: listClip },
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
  // "جزئیات" is a link to a page, not a dialog — an approved invoice, because
  // that is the one with a payment address on it.
  { name: "u-export-detail", as: "merchant", path: "/receive/INV-1044", clip: fullish, wait: 1800 },
  { name: "u-imports", as: "merchant", path: "/imports", clip: listClip },
  // The import list holds its own detail inline, so the row is the shot.
  { name: "u-import-detail", as: "merchant", path: "/imports", clip: { x: 0, y: 0, w: 1, h: 0.72 }, wait: 1800 },
  { name: "u-settlement", as: "merchant", path: "/settlement", clip: listClip },
  { name: "u-wallets", as: "merchant", path: "/wallets", clip: listClip },
  { name: "u-reports", as: "merchant", path: "/reports", clip: fullish },

  // ── the foreign buyer
  { name: "f-dash", as: "foreign", path: "/foreign/dashboard", clip: fullish },
  { name: "f-invoices", as: "foreign", path: "/foreign/invoices", clip: listClip },
  // The payment page: the address, the amount, and the QR the buyer scans.
  { name: "f-pay", as: "foreign", path: "/pay/INV-1050", clipTo: ".max-w-md", wait: 2200 },
  { name: "f-pay-address", as: "foreign", path: "/pay/INV-1050", clipTo: ".max-w-md", ring: ".font-mono", wait: 2200 },
  { name: "f-wallets", as: "foreign", path: "/foreign/wallets", clip: listClip },
  { name: "f-reports", as: "foreign", path: "/foreign/reports", clip: fullish },

  // ── the organisation
  { name: "a-dash", as: "admin", path: "/admin/dashboard", clip: fullish },
  { name: "a-kyc", as: "admin", path: "/admin/kyc", clip: listClip },
  { name: "a-invoices", as: "admin", path: "/admin/invoices", click: ["text=همه"], clip: listClip },
  { name: "a-invoice-review", as: "admin", path: "/admin/invoices", click: ["text=همه", "tbody tr:nth-child(1) >> text=بررسی"], clipTo: '[role="dialog"]', wait: 1800 },
  { name: "a-settlements", as: "admin", path: "/admin/settlements", click: ["text=همه"], clip: listClip },
  { name: "a-transactions", as: "admin", path: "/admin/transactions", clip: listClip },
  { name: "a-ledger", as: "admin", path: "/admin/ledger", clip: fullish },
  { name: "a-reports", as: "admin", path: "/admin/reports", clip: fullish },
  { name: "a-users", as: "admin", path: "/admin/users", clip: listClip },

  // ── the bank
  { name: "b-dash", as: "bank", path: "/bank/dashboard", clip: fullish },
  { name: "b-imports", as: "bank", path: "/bank/imports", clip: listClip },
  { name: "b-import-review", as: "bank", path: "/bank/imports", click: ["tbody tr:nth-child(1) >> text=بررسی"], clip: fullish, wait: 1600 },
  { name: "b-settlement", as: "bank", path: "/bank/settlement", clip: listClip },
  { name: "b-deposits", as: "bank", path: "/bank/deposits", clip: listClip },
  { name: "b-wallets", as: "bank", path: "/bank/wallets", clip: listClip },
  { name: "b-reports", as: "bank", path: "/bank/reports", clip: fullish },
];

// ─────────────────────────────────────────────────────────────── panels ──

const USER_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بازرگان داخلی", sub: "سامانهٔ پرداخت ارزی منطقه آزاد" },
  { kind: "shot", shot: "u-dash", caption: "اینجا جایی است که بازرگان ایرانی کار خود را دنبال می‌کند." },
  { kind: "flow", flow: EXPORT_FLOW, caption: "دو مسیر وجود دارد. اول: صادرات — کالا می‌رود، ارز می‌آید." },
  { kind: "shot", shot: "u-exports", caption: "«صادرات» فهرست فاکتورهایی است که برای خریدار خارجی صادر کرده‌اید." },
  { kind: "shot", shot: "u-export-new", caption: "فاکتور تازه: مبلغ، شرح کالا، و شناسهٔ خریدار." },
  { kind: "flow", flow: EXPORT_FLOW, active: 1, caption: "سازمان فاکتور را می‌بیند و تأیید می‌کند." },
  { kind: "shot", shot: "u-export-detail", caption: "پس از تأیید، یک آدرس پرداخت فقط برای همین فاکتور ساخته می‌شود." },
  { kind: "flow", flow: EXPORT_FLOW, active: 3, caption: "خریدار به همان آدرس پرداخت می‌کند. سامانه خودش روی زنجیره می‌بیند." },
  { kind: "shot", shot: "u-dash-cards", caption: "وضعیت فاکتور خودبه‌خود به «واریز شد» تغییر می‌کند." },
  { kind: "flow", flow: EXPORT_FLOW, active: 5, caption: "بانک معادل ریالی را به حساب شما می‌ریزد." },
  { kind: "shot", shot: "u-settlement", caption: "«تسویه ریالی» نشان می‌دهد چقدر و کِی به حسابتان آمد." },
  { kind: "flow", flow: IMPORT_FLOW, caption: "مسیر دوم: واردات — کالا می‌آید، شما ریال می‌پردازید." },
  { kind: "shot", shot: "u-imports", caption: "«واردات» فاکتورهایی است که فروشندهٔ خارجی برای شما صادر کرده." },
  { kind: "shot", shot: "u-import-detail", caption: "بانک نرخ را اعلام و شمارهٔ حساب ریالی را می‌دهد." },
  { kind: "flow", flow: IMPORT_FLOW, active: 4, caption: "ریال را واریز می‌کنید؛ ارز را بانک برای فروشنده می‌فرستد." },
  { kind: "shot", shot: "u-wallets", caption: "«مدیریت والت»: کیف پولی که ارز شما به آن می‌رسد." },
  { kind: "shot", shot: "u-reports", caption: "«گزارشات»: هرچه گذشته، با امکان خروجی گرفتن." },
  { kind: "title", heading: "همین.", sub: "فاکتور صادر کنید — بقیه‌اش خودکار پیش می‌رود." },
];

const FOREIGN_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بازرگان خارجی", sub: "سامانهٔ پرداخت ارزی منطقه آزاد" },
  { kind: "shot", shot: "f-dash", caption: "خریدار خارجی از این پنل بدهی خود را می‌بیند و می‌پردازد." },
  { kind: "flow", flow: EXPORT_FLOW, active: 3, caption: "فروشندهٔ ایرانی فاکتور صادر می‌کند؛ شما پرداخت می‌کنید." },
  { kind: "shot", shot: "f-invoices", caption: "«فاکتورها»: هر درخواستی که به نام شما صادر شده — پرداخت‌شده و پرداخت‌نشده." },
  { kind: "shot", shot: "f-pay", caption: "هر فاکتور یک صفحهٔ پرداخت دارد." },
  { kind: "shot", shot: "f-pay-address", caption: "یک آدرس اختصاصی، فقط برای همین فاکتور. ارز را به آن بفرستید." },
  { kind: "flow", flow: EXPORT_FLOW, active: 4, caption: "قرارداد خودش مبلغ را تقسیم می‌کند: فروشنده، درگاه، سازمان." },
  { kind: "shot", shot: "f-pay", caption: "مبلغ، مهلت، و شبکه‌ای که باید روی آن بفرستید — همه در یک صفحه." },
  { kind: "shot", shot: "f-dash", caption: "پس از تأیید شبکه، وضعیت در داشبورد خودبه‌خود عوض می‌شود." },
  { kind: "shot", shot: "f-wallets", caption: "«کیف پول»: نشانی‌هایی که به نام شما ثبت شده." },
  { kind: "shot", shot: "f-reports", caption: "«گزارشات»: سابقهٔ کامل پرداخت‌های شما." },
  { kind: "title", heading: "همین.", sub: "به آدرس فاکتور بپردازید — تأیید خودکار است." },
];

const ADMIN_BEATS: Beat[] = [
  { kind: "title", heading: "پنل سازمان منطقه آزاد", sub: "نظارت بر کل سامانه" },
  { kind: "shot", shot: "a-dash", caption: "سازمان ناظر است: تأیید می‌کند، می‌بیند، و سهم خود را دریافت می‌کند." },
  { kind: "shot", shot: "a-kyc", caption: "«احراز هویت»: هیچ‌کس بدون تأیید سازمان وارد تجارت نمی‌شود." },
  { kind: "flow", flow: EXPORT_FLOW, active: 1, caption: "هر فاکتور پیش از صدور آدرس پرداخت، از اینجا رد می‌شود." },
  { kind: "shot", shot: "a-invoices", caption: "«فاکتورها»: همهٔ فاکتورها، با جهت صادرات یا واردات." },
  { kind: "shot", shot: "a-invoice-review", caption: "تأیید یا رد — و رد همیشه دلیل می‌خواهد." },
  { kind: "shot", shot: "a-transactions", caption: "«تراکنش‌ها»: هر پرداختی که سامانه روی زنجیره دیده است." },
  { kind: "shot", shot: "a-settlements", caption: "«تسویه‌ها»: ریالی که باید به بازرگان برسد." },
  { kind: "shot", shot: "a-ledger", caption: "«دفتر کل»: هر ریال و هر واحد ارز، در یک حساب." },
  { kind: "flow", flow: EXPORT_FLOW, active: 4, caption: "کارمزد درگاه بین سامانه و سازمان تقسیم می‌شود — روی زنجیره." },
  { kind: "shot", shot: "a-reports", caption: "«گزارشات»: حجم، توزیع ارز، و روند ماهانه." },
  { kind: "shot", shot: "a-users", caption: "«کاربران»: چه کسی در سامانه هست و در چه نقشی." },
  { kind: "shot", shot: "a-dash", caption: "همه‌چیز در یک نگاه: در انتظار تأیید، حجم، و آخرین رویدادها." },
  { kind: "title", heading: "همین.", sub: "سازمان تأیید می‌کند و همه‌چیز را می‌بیند." },
];

const BANK_BEATS: Beat[] = [
  { kind: "title", heading: "پنل بانک", sub: "صرافی سامانه — ارز و ریال" },
  { kind: "shot", shot: "b-dash", caption: "بانک نقش صرافی را دارد: ارز می‌دهد و ریال می‌گیرد، و برعکس." },
  { kind: "flow", flow: EXPORT_FLOW, active: 5, caption: "در صادرات: ارز نزد بانک می‌ماند و ریالش به بازرگان می‌رسد." },
  { kind: "shot", shot: "b-settlement", caption: "«تسویه»: صف بازرگانانی که منتظر ریال هستند." },
  { kind: "flow", flow: IMPORT_FLOW, active: 2, caption: "در واردات: بانک نرخ را اعلام می‌کند." },
  { kind: "shot", shot: "b-imports", caption: "«واردات»: فاکتورهایی که منتظر نرخ یا منتظر ارز هستند." },
  { kind: "shot", shot: "b-import-review", caption: "نرخ را وارد و حساب ریالی را اعلام می‌کند." },
  { kind: "flow", flow: IMPORT_FLOW, active: 5, caption: "پس از دریافت ریال، ارز را برای فروشندهٔ خارجی می‌فرستد." },
  { kind: "shot", shot: "b-deposits", caption: "«واریزی‌ها»: ارزی که رسیده و هنوز آزاد نشده." },
  { kind: "shot", shot: "b-deposits", caption: "هر واریزی نشان می‌دهد سهم درگاه، سازمان و بانک چقدر خواهد شد." },
  { kind: "shot", shot: "b-wallets", caption: "«کیف پول‌ها»: موجودی ارزی بانک، در لحظه." },
  { kind: "shot", shot: "b-reports", caption: "«گزارشات»: جریان ارز و ریال، ماه به ماه." },
  { kind: "title", heading: "همین.", sub: "بانک نرخ می‌دهد، ریال می‌گیرد، ارز می‌فرستد." },
];

export const BEATS: Record<PanelKey, Beat[]> = {
  user: USER_BEATS,
  foreign: FOREIGN_BEATS,
  admin: ADMIN_BEATS,
  bank: BANK_BEATS,
};

export const runtimeOf = (key: PanelKey) =>
  BEATS[key].reduce((total, beat) => total + beatSeconds(beat), 0);
