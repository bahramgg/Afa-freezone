import "server-only";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { db } from "../db";
import { forbidden } from "../http";
import { formatJalali } from "@/lib/format";
import { invoiceScope, settlementScope } from "../scope";
import type { SessionUser } from "../auth/session";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Report export.
 *
 * The workbook is built on the server from the database, not from whatever the
 * client store happens to be holding: an export is the artefact people file and
 * argue over, so it has to carry every row the caller may see rather than the
 * page they were looking at. Row visibility comes from the same scope functions
 * the list endpoints use, so an export can never widen what a role can read.
 */

type Column<Row> = {
  header: string;
  width: number;
  /** Always text, so long reference numbers and hashes are never rounded. */
  value: (row: Row) => string;
};

type Dataset<Row> = {
  sheet: string;
  file: string;
  roles: SessionUser["role"][];
  columns: Column<Row>[];
  read: (user: SessionUser) => Promise<Row[]>;
};

/**
 * Pairs a query with the columns that render it. The reader comes first so the
 * row type is inferred from the query, and every column is then checked against
 * the shape Prisma actually returns.
 */
function dataset<Row>(
  read: (user: SessionUser) => Promise<Row[]>,
  config: Omit<Dataset<Row>, "read">,
): Dataset<Row> {
  return { ...config, read };
}

const STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  PAYMENT_PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  EXPIRED: "منقضی شده",
  REJECTED: "رد شده",
  AWAITING_COUNTERPARTY: "در انتظار طرف خارجی",
  AWAITING_ADMIN: "در انتظار ادمین",
  AWAITING_BANK_REVIEW: "در انتظار بانک",
  AWAITING_BANK: "در انتظار بانک",
  BANK_RATE_LOCKED: "نرخ قفل شده",
  RIAL_RECEIVED: "ریال دریافت شد",
  CRYPTO_SENT: "کریپتو ارسال شد",
  CRYPTO_RECEIVED: "کریپتو دریافت شد",
  CRYPTO_CONFIRMED: "کریپتو تأیید شد",
  SETTLED: "تسویه شده",
  SEEN: "مشاهده شده",
  CONFIRMING: "در حال تأیید",
  CONFIRMED: "تأیید شده",
  FAILED: "ناموفق",
};

const ROLE_FA: Record<string, string> = {
  IRANIAN: "تاجر ایرانی",
  FOREIGN: "تاجر خارجی",
  ADMIN: "ادمین",
  BANK: "بانک",
};

const KYC_FA: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
};

const ACCOUNT_FA: Record<string, string> = {
  DEPOSIT_HELD: "نزد آدرس‌های واریز",
  BANK_HELD: "نزد خزانه بانک",
  MERCHANT_PAYABLE: "بدهی به تاجران",
  GATEWAY_SHARE: "سهم درگاه",
  FREEZONE_SHARE: "سهم سازمان منطقه آزاد",
  BANK_SPREAD: "حاشیه صرافی بانک",
};

const KIND_FA: Record<string, string> = {
  INVOICE_PAID: "پرداخت فاکتور",
  DEPOSIT_SWEPT: "برداشت به خزانه",
  SETTLEMENT_FUNDED: "دریافت کریپتو برای تسویه",
  SETTLEMENT_SETTLED: "پرداخت ریال به تاجر",
};

const status = (value: string | null | undefined) => (value ? (STATUS_FA[value] ?? value) : "—");
const text = (value: unknown) => (value == null || value === "" ? "—" : String(value));
const money = (value: Prisma.Decimal | null | undefined) => (value == null ? "—" : value.toString());
const when = (value: Date | null | undefined) => (value ? formatJalali(value.toISOString()) : "—");

const DATASETS = {
  invoices: dataset(
    (user: SessionUser) =>
      db.invoice.findMany({
        where: invoiceScope(user),
        include: { owner: { select: { uid: true, fullName: true } }, chainTx: true },
        orderBy: { createdAt: "desc" },
      }),
    {
      sheet: "فاکتورها",
      file: "invoices",
      // A foreign account is on both sides of an invoice now: the exports it
      // was asked to pay and the imports it raised. Its own rows are already
      // narrowed by invoiceScope, so this hands it nothing it cannot see.
      roles: ["IRANIAN", "FOREIGN", "ADMIN"],
      columns: [
        { header: "شماره فاکتور", width: 16, value: (r) => text(r.ref) },
        { header: "شناسه تراکنش", width: 16, value: (r) => text(r.trxRef) },
        { header: "تاجر", width: 24, value: (r) => `${r.owner.fullName} (${r.owner.uid})` },
        { header: "پرداخت‌کننده", width: 22, value: (r) => text(r.senderName) },
        { header: "کالا یا خدمت", width: 26, value: (r) => text(r.goodsTitle) },
        { header: "شرح", width: 32, value: (r) => text(r.description) },
        { header: "مبلغ", width: 16, value: (r) => money(r.amount) },
        { header: "ارز", width: 9, value: (r) => text(r.currency) },
        { header: "کارمزد", width: 14, value: (r) => money(r.feeAmount) },
        { header: "مبلغ خالص", width: 16, value: (r) => money(r.netAmount) },
        { header: "وضعیت", width: 18, value: (r) => status(r.status) },
        { header: "آدرس پرداخت", width: 46, value: (r) => text(r.paymentAddress) },
        { header: "هش تراکنش", width: 68, value: (r) => text(r.chainTx?.hash) },
        { header: "تاریخ ثبت", width: 20, value: (r) => when(r.createdAt) },
        { header: "تاریخ پرداخت", width: 20, value: (r) => when(r.paidAt) },
      ],
    },
  ),

  settlements: dataset(
    (user: SessionUser) =>
      db.settlement.findMany({
        where: settlementScope(user),
        include: {
          owner: { select: { uid: true, fullName: true } },
          chainTx: true,
          sourceInvoice: { select: { ref: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    {
      sheet: "درخواست‌های تسویه",
      file: "settlements",
      roles: ["IRANIAN", "ADMIN", "BANK"],
      columns: [
        { header: "شماره درخواست", width: 16, value: (r) => text(r.ref) },
        { header: "شناسه تراکنش", width: 16, value: (r) => text(r.trxRef) },
        { header: "تاجر", width: 24, value: (r) => `${r.owner.fullName} (${r.owner.uid})` },
        { header: "کالا یا خدمت", width: 26, value: (r) => text(r.goodsTitle) },
        { header: "شرح", width: 32, value: (r) => text(r.description) },
        { header: "مبلغ", width: 16, value: (r) => money(r.amount) },
        { header: "ارز", width: 9, value: (r) => text(r.currency) },
        { header: "کارمزد", width: 14, value: (r) => money(r.feeAmount) },
        { header: "مبلغ مبنای ریال", width: 18, value: (r) => money(r.netAmount) },
        { header: "نرخ (ریال)", width: 16, value: (r) => money(r.exchangeRate) },
        { header: "معادل ریالی", width: 20, value: (r) => money(r.rialAmount) },
        { header: "حاشیه بانک (ریال)", width: 20, value: (r) => money(r.bankSpreadRial) },
        { header: "وضعیت", width: 20, value: (r) => status(r.status) },
        { header: "منشأ", width: 18, value: (r) => (r.sourceInvoice ? r.sourceInvoice.ref : "درخواست تاجر") },
        { header: "والت مبدأ", width: 46, value: (r) => text(r.walletAddress) },
        { header: "والت بانک", width: 46, value: (r) => text(r.bankWalletAddress) },
        { header: "حساب مقصد", width: 30, value: (r) => text(r.payoutAccount) },
        { header: "شماره رسید", width: 16, value: (r) => text(r.rialReceiptNo) },
        { header: "هش تراکنش", width: 68, value: (r) => text(r.chainTx?.hash) },
        { header: "دلیل رد", width: 30, value: (r) => text(r.rejectReason) },
        { header: "تاریخ ثبت", width: 20, value: (r) => when(r.createdAt) },
        { header: "تاریخ تسویه", width: 20, value: (r) => when(r.settledAt) },
      ],
    },
  ),

  transactions: dataset(
    () =>
      db.chainTx.findMany({
        include: { invoice: true, settlement: true },
        orderBy: { seenAt: "desc" },
      }),
    {
      sheet: "تراکنش‌های زنجیره",
      file: "chain-transactions",
      roles: ["ADMIN", "BANK"],
      columns: [
        { header: "هش", width: 68, value: (r) => text(r.hash) },
        { header: "جهت", width: 10, value: (r) => (r.direction === "IN" ? "ورودی" : "خروجی") },
        { header: "وضعیت", width: 14, value: (r) => status(r.status) },
        { header: "از", width: 46, value: (r) => text(r.fromAddress) },
        { header: "به", width: 46, value: (r) => text(r.toAddress) },
        { header: "مبلغ", width: 18, value: (r) => money(r.amount) },
        { header: "ارز", width: 9, value: (r) => text(r.currency) },
        { header: "بلاک", width: 14, value: (r) => text(r.blockNumber?.toString()) },
        { header: "تأییدیه", width: 12, value: (r) => String(r.confirmations) },
        {
          header: "مرتبط با",
          width: 18,
          value: (r) => text(r.invoice?.ref ?? r.settlement?.ref),
        },
        { header: "تاریخ مشاهده", width: 20, value: (r) => when(r.seenAt) },
        { header: "تاریخ تأیید", width: 20, value: (r) => when(r.confirmedAt) },
      ],
    },
  ),

  ledger: dataset(
    () =>
      db.ledgerEntry.findMany({
        include: { user: { select: { uid: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      }),
    {
      sheet: "دفتر کل",
      file: "ledger",
      roles: ["ADMIN", "BANK"],
      columns: [
        { header: "تاریخ", width: 20, value: (r) => when(r.createdAt) },
        { header: "حساب", width: 24, value: (r) => ACCOUNT_FA[r.account] ?? r.account },
        { header: "رویداد", width: 22, value: (r) => KIND_FA[r.kind] ?? r.kind },
        { header: "مبلغ", width: 20, value: (r) => r.amount.toString() },
        { header: "واحد", width: 9, value: (r) => text(r.unit) },
        { header: "مرجع", width: 46, value: (r) => text(r.subjectRef) },
        {
          header: "تاجر",
          width: 24,
          value: (r) => (r.user ? `${r.user.fullName} (${r.user.uid})` : "—"),
        },
        { header: "توضیح", width: 32, value: (r) => text(r.note) },
      ],
    },
  ),

  users: dataset(() => db.user.findMany({ orderBy: { createdAt: "desc" } }), {
    sheet: "کاربران",
    file: "users",
    roles: ["ADMIN"],
    columns: [
      { header: "شناسه", width: 12, value: (r) => text(r.uid) },
      { header: "نام", width: 26, value: (r) => text(r.fullName) },
      { header: "نقش", width: 14, value: (r) => ROLE_FA[r.role] ?? r.role },
      { header: "ایمیل", width: 30, value: (r) => text(r.email) },
      { header: "موبایل", width: 18, value: (r) => text(r.phone) },
      { header: "کد ملی", width: 16, value: (r) => text(r.nationalId) },
      { header: "شماره گذرنامه", width: 18, value: (r) => text(r.passportNo) },
      { header: "کشور", width: 16, value: (r) => text(r.country) },
      { header: "احراز هویت", width: 14, value: (r) => KYC_FA[r.kyc] ?? r.kyc },
      { header: "دلیل رد", width: 30, value: (r) => text(r.kycRejectReason) },
      { header: "وضعیت حساب", width: 14, value: (r) => (r.disabledAt ? "غیرفعال" : "فعال") },
      { header: "تاریخ ثبت‌نام", width: 20, value: (r) => when(r.createdAt) },
    ],
  }),
};

export type DatasetKey = keyof typeof DATASETS;

export const DATASET_KEYS = Object.keys(DATASETS) as DatasetKey[];

/** Which exports a role may ask for. */
export function datasetsFor(role: SessionUser["role"]): DatasetKey[] {
  return DATASET_KEYS.filter((key) => (DATASETS[key].roles as string[]).includes(role));
}

const HEADER = {
  fontWeight: "bold",
  backgroundColor: "#EEF2F7",
  align: "right",
  wrap: true,
} as const;

export async function buildReport(
  user: SessionUser,
  key: DatasetKey,
): Promise<{ buffer: Buffer; filename: string }> {
  const spec = DATASETS[key] as Dataset<unknown>;
  if (!(spec.roles as string[]).includes(user.role)) throw forbidden();

  const rows = await spec.read(user);

  const data: SheetData = [
    spec.columns.map((c) => ({ value: c.header, ...HEADER })),
    ...rows.map((row) =>
      spec.columns.map((c) => ({ value: c.value(row), align: "right" as const })),
    ),
  ];

  const workbook = await writeXlsxFile(data, {
    sheet: spec.sheet,
    // Everything in the workbook is Persian, so column A belongs on the right.
    rightToLeft: true,
    // The header stays put while an operator scrolls a few thousand rows.
    stickyRowsCount: 1,
    columns: spec.columns.map((c) => ({ width: c.width })),
  });

  return { buffer: await workbook.toBuffer(), filename: `afa-${spec.file}.xlsx` };
}
