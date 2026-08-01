import { Badge } from "@/components/ui/Badge";
import type { InvoiceStatus, SendStatus, SettlementStatus, Transaction } from "@/lib/types";

type Tone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

const INVOICE_LABELS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "در انتظار تأیید ادمین", tone: "warning" },
  APPROVED: { label: "تأیید شده — منتظر پرداخت", tone: "info" },
  PAYMENT_PENDING: { label: "منتظر پرداخت", tone: "primary" },
  PAID: { label: "موفق — واریز شد", tone: "success" },
  EXPIRED: { label: "منقضی", tone: "neutral" },
  REJECTED: { label: "رد شده", tone: "destructive" },
};

const SEND_LABELS: Record<SendStatus, { label: string; tone: Tone }> = {
  AWAITING_COUNTERPARTY: { label: "در انتظار تأیید کاربر خارجی", tone: "warning" },
  AWAITING_ADMIN: { label: "در انتظار تأیید ادمین", tone: "warning" },
  AWAITING_BANK_REVIEW: { label: "در انتظار تأمین بانک", tone: "warning" },
  BANK_RATE_LOCKED: { label: "نرخ اعلام شد — منتظر واریز ریال", tone: "info" },
  RIAL_RECEIVED: { label: "واریز ریال تأیید شد — در حال ارسال کریپتو", tone: "info" },
  CRYPTO_SENT: { label: "کریپتو به والت شما ارسال شد", tone: "info" },
  PAYMENT_PENDING: { label: "منتظر پرداخت", tone: "primary" },
  PAID: { label: "موفق — کاربر خارجی دریافت کرد", tone: "success" },
  REJECTED: { label: "رد شده", tone: "destructive" },
};

const SETTLEMENT_LABELS: Record<SettlementStatus, { label: string; tone: Tone }> = {
  AWAITING_ADMIN: { label: "در انتظار تأیید ادمین", tone: "warning" },
  AWAITING_BANK: { label: "در انتظار تأیید بانک", tone: "warning" },
  BANK_RATE_LOCKED: { label: "آدرس والت اعلام شد — منتظر واریز کریپتو", tone: "info" },
  CRYPTO_RECEIVED: { label: "TX hash دریافت شد — در حال تأیید بلاکچین", tone: "info" },
  CRYPTO_CONFIRMED: { label: "کریپتو تأیید شد — در حال واریز ریال", tone: "info" },
  BANK_APPROVED: { label: "تأیید شده", tone: "info" },
  SETTLED: { label: "موفق — ریال واریز شد", tone: "success" },
  REJECTED: { label: "رد شده", tone: "destructive" },
};

const TX_LABELS: Record<Transaction["status"], { label: string; tone: Tone }> = {
  CONFIRMED: { label: "موفق — واریز شد", tone: "success" },
  PENDING: { label: "در انتظار تأیید شبکه", tone: "warning" },
  SEEN: { label: "مشاهده شد — در انتظار تأییدیه", tone: "info" },
  CONFIRMING: { label: "در حال تأیید روی شبکه", tone: "info" },
  FAILED: { label: "ناموفق", tone: "destructive" },
  // A deposit seen on-chain that no invoice claims yet — not a failure.
  UNMATCHED: { label: "بدون فاکتور متناظر", tone: "neutral" },
};

export function TransactionStatusBadge({ status }: { status: Transaction["status"] }) {
  const meta = TX_LABELS[status];
  if (!meta) return <Badge tone="neutral">{status}</Badge>;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, tone } = INVOICE_LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SendStatusBadge({ status }: { status: SendStatus }) {
  const meta = SEND_LABELS[status];
  if (!meta) return <Badge tone="neutral">{status}</Badge>;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  const meta = SETTLEMENT_LABELS[status];
  if (!meta) return <Badge tone="neutral">{status}</Badge>;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function HighLevelBadge({
  level,
  label,
}: {
  level: "pending" | "in-progress" | "success" | "rejected" | "expired";
  label?: string;
}) {
  const map: Record<typeof level, { text: string; tone: Tone }> = {
    pending: { text: "در انتظار", tone: "warning" },
    "in-progress": { text: "در جریان", tone: "info" },
    success: { text: "موفق", tone: "success" },
    rejected: { text: "رد شده", tone: "destructive" },
    expired: { text: "منقضی", tone: "neutral" },
  };
  const m = map[level];
  return <Badge tone={m.tone}>{label ?? m.text}</Badge>;
}
