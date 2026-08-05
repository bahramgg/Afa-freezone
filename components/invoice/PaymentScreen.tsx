"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, CheckCircle2, Clock, ExternalLink, Loader2, Share2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/shared/CopyButton";
import { Countdown } from "@/components/shared/Countdown";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { bscScanUrl, formatAmount, truncateAddress, truncateHash } from "@/lib/format";
import { toast } from "sonner";
import Link from "next/link";
import type { Invoice } from "@/lib/types";

export function PaymentScreen({ invoice }: { invoice: Invoice }) {
  const expire = useInvoicesStore((s) => s.expire);
  const startPayment = useInvoicesStore((s) => s.startPayment);
  const confirmPayment = useInvoicesStore((s) => s.confirmPayment);
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPayable = invoice.status === "APPROVED" || invoice.status === "PAYMENT_PENDING";
  const isPaid = invoice.status === "PAID";
  const isExpired = invoice.status === "EXPIRED";
  /** Money is on chain for this invoice but not yet irreversible. */
  const inFlight = (invoice.pendingAmount ?? 0) > 0 && !isPaid;

  /**
   * Deposits are normally picked up by the on-chain watcher. This lets a payer
   * hand the hash over directly; the server still verifies amount, recipient
   * and success against the chain before anything is marked paid.
   */
  async function submitPayment() {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())) {
      toast.error("هش تراکنش معتبر نیست");
      return;
    }
    setSubmitting(true);
    try {
      if (invoice.status === "APPROVED") await startPayment(invoice.id);
      await confirmPayment(invoice.id, txHash.trim());
      toast.success("پرداخت تأیید شد", {
        description: `مبلغ ${formatAmount(invoice.amount)} ${invoice.currency} روی شبکه تأیید شد`,
      });
      setTxHash("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تأیید پرداخت ناموفق بود");
    } finally {
      setSubmitting(false);
    }
  }

  async function shareGateway() {
    // The buyer's link is the public checkout, not this page — this one is
    // behind the merchant's own login.
    const path = `/pay/${invoice.id}`;
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    const title = `درگاه پرداخت ${invoice.id}`;
    const text = `پرداخت ${formatAmount(invoice.amount)} ${invoice.currency} — ${invoice.trxId}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("لینک درگاه پرداخت کپی شد", { description: url });
    } catch {
      toast.error("اشتراک‌گذاری انجام نشد");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/receive">
            <ArrowRight className="h-4 w-4" />
            بازگشت به لیست
          </Link>
        </Button>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              صفحه پرداخت {invoice.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isPaid ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-success/30 bg-success/5 p-5 text-center space-y-3"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div className="font-semibold">پرداخت با موفقیت انجام شد</div>
                {invoice.txHash ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-muted-foreground">TX hash:</span>
                    <a
                      href={bscScanUrl(invoice.txHash)}
                      target="_blank"
                      rel="noopener"
                      className="text-primary hover:underline font-mono inline-flex items-center gap-1"
                    >
                      {truncateHash(invoice.txHash)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <CopyButton value={invoice.txHash} label="" />
                  </div>
                ) : null}
              </motion.div>
            ) : isExpired ? (
              <div className="rounded-lg border border-border bg-muted/40 p-5 text-center text-muted-foreground">
                این فاکتور منقضی شده است
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-lg border border-border bg-white p-3">
                    <QRCodeSVG
                      value={`bsc:${invoice.paymentAddress}?amount=${invoice.amount}&currency=${invoice.currency}`}
                      size={180}
                      level="M"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    این QR را اسکن کنید یا آدرس را کپی کنید
                  </p>
                </div>

                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">آدرس کیف پول گیت‌وی</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs break-all">{invoice.paymentAddress}</span>
                    <CopyButton value={invoice.paymentAddress} label="کپی آدرس" />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={shareGateway}
                >
                  <Share2 className="h-4 w-4" />
                  اشتراک‌گذاری درگاه پرداخت
                </Button>

                {/*
                  A transfer is on chain and settling. The countdown is the wrong
                  thing to show now — the payer has done everything they were
                  asked to, and watching a clock run out while their money is in
                  flight reads as a deadline they are about to miss. They are
                  not: the invoice is held open until this finalises.
                */}
                {inFlight ? (
                  <div className="rounded-md bg-info/15 px-3 py-2 space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-info">
                      <Clock className="h-4 w-4" />
                      پرداخت دریافت شد — در انتظار نهایی‌شدن روی شبکه
                    </span>
                    <p className="text-xs text-muted-foreground">
                      <MoneyText amount={invoice.pendingAmount ?? 0} currency={invoice.currency} />
                      {" "}دیده شد. کار دیگری لازم نیست؛ پس از قطعی‌شدن روی زنجیره، فاکتور
                      خودبه‌خود تسویه می‌شود.
                    </p>
                  </div>
                ) : invoice.expiresAt && invoice.status !== "PAID" ? (
                  <div className="flex items-center justify-between rounded-md bg-warning/15 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-warning-foreground text-xs">
                      <Clock className="h-4 w-4" />
                      زمان باقی‌مانده
                    </span>
                    <Countdown
                      to={invoice.expiresAt}
                      onExpire={() => expire(invoice.id)}
                      className="font-mono text-base font-medium tabular-nums"
                    />
                  </div>
                ) : null}

                {isPayable ? (
                  <div className="space-y-2">
                    <label htmlFor="txHash" className="text-xs text-muted-foreground">
                      پس از پرداخت، هش تراکنش را اینجا وارد کنید (یا منتظر تأیید خودکار بمانید)
                    </label>
                    <Input
                      id="txHash"
                      dir="ltr"
                      placeholder="0x..."
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={submitPayment}
                      disabled={submitting}
                      className="w-full"
                      size="lg"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      ثبت و راستی‌آزمایی پرداخت
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                    این فاکتور در انتظار تأیید ادمین است. پس از تأیید، آدرس پرداخت فعال می‌شود.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>اطلاعات فاکتور</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="شماره" value={invoice.id} />
            <Row label="مبلغ" value={<MoneyText amount={invoice.amount} currency={invoice.currency} />} />
            <Row label="ارز" value={<Badge tone="primary">{invoice.currency}</Badge>} />
            <Row label="ارسال کننده" value={invoice.senderName || "—"} />
            <Row label="کالای صادره" value={invoice.goodsTitle || "—"} />
            <Row label="تاریخ ایجاد" value={<JalaliDate iso={invoice.createdAt} withTime />} />
            <Row label="آخرین تغییر" value={<JalaliDate iso={invoice.updatedAt} withTime />} />
            {invoice.description ? (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">توضیحات</div>
                <p className="text-xs leading-6">{invoice.description}</p>
              </div>
            ) : null}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">آدرس پرداخت</div>
              <div className="font-mono text-xs">{truncateAddress(invoice.paymentAddress, 10, 8)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
