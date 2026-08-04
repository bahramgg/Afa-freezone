import { Badge } from "@/components/ui/Badge";
import type { InvoiceStatus, SettlementStatus, Transaction } from "@/lib/types";

type Tone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

const INVOICE_LABELS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "در انتظار تأیید ادمین", tone: "warning" },
  APPROVED: { label: "تأیید شده — منتظر پرداخت", tone: "info" },
  BANK_RATE_LOCKED: { label: "نرخ اعلام شد — منتظر واریز ریال", tone: "info" },
  RIAL_RECEIVED: { label: "ریال دریافت شد — تأمین ارز", tone: "primary" },
  PAYMENT_PENDING: { label: "منتظر پرداخت", tone: "primary" },
  PAID: { label: "موفق — واریز شد", tone: "success" },
  EXPIRED: { label: "منقضی", tone: "neutral" },
  REJECTED: { label: "رد شده", tone: "destructive" },
  CANCELLING: { label: "لغو شده — در انتظار بازگشت ریال", tone: "warning" },
  CANCELLED: { label: "لغو شده", tone: "neutral" },
};


const SETTLEMENT_LABELS: Record<SettlementStatus, { label: string; tone: Tone }> = {
  AWAITING_ADMIN: { label: "در انتظار تأیید ادمین", tone: "warning" },
  AWAITING_BANK: { label: "در انتظار تأیید بانک", tone: "warning" },
  BANK_RATE_LOCKED: { label: "آدرس والت اعلام شد — منتظر واریز کریپتو", tone: "info" },
  CRYPTO_RECEIVED: { label: "TX hash دریافت شد — در حال تأیید بلاکچین", tone: "info" },
  CRYPTO_CONFIRMED: { label: "کریپتو تأیید شد — در حال واریز ریال", tone: "info" },
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
