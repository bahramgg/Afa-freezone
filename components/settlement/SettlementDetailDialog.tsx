"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { formatAmount, toPersianDigits, truncateAddress, truncateHash } from "@/lib/format";
import type { Settlement } from "@/lib/types";
import { explorerUrl } from "@/lib/chains";

export function SettlementDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Settlement | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const submitUserTx = useSettlementsStore((s) => s.submitUserTx);
  const [txInput, setTxInput] = useState("");

  if (!item) return null;

  function handleSubmitTx() {
    if (!item) return;
    if (!txInput.match(/^0x[a-fA-F0-9]{16,}$/)) {
      toast.error("هش تراکنش معتبر نیست");
      return;
    }
    submitUserTx(item.id, txInput);
    toast.success("TX hash ثبت شد", { description: "بانک در حال بررسی است" });
    setTxInput("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>درخواست تسویه — {item.trxId} ({item.id})</DialogTitle>
          <DialogDescription>اطلاعات کامل و وضعیت مرحله‌ای</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm py-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">وضعیت</span>
            <SettlementStatusBadge status={item.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مشخصات کالا" value={item.goodsTitle} />
            <Field label="مبلغ" value={<MoneyText amount={item.amount} currency={item.currency} />} />
            <Field
              label="نرخ ارز"
              value={
                <span className={item.rateLocked ? "text-success" : "text-muted-foreground"}>
                  {toPersianDigits(formatAmount(item.exchangeRate ?? 0))} ت ({item.rateLocked ? "قطعی" : "تخمینی"})
                </span>
              }
            />
            <Field label="معادل ریالی" value={`${toPersianDigits(formatAmount(item.rialAmount ?? 0))} ت`} />
            <Field label="تاریخ ارسال" value={<JalaliDate iso={item.createdAt} />} />
            <Field label="تاریخ تسویه" value={item.settledAt ? <JalaliDate iso={item.settledAt} /> : "—"} />
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">توضیحات</div>
            <p className="text-xs leading-6">{item.description}</p>
          </div>
          <div className="grid gap-2">
            <Row
              label="هش تراکنش دریافتی"
              value={truncateHash(item.txHash)}
              copy={item.txHash}
              link={explorerUrl(item.txHash)}
            />
            {item.walletAddress ? (
              <Row label="کیف پول کاربر" value={truncateAddress(item.walletAddress)} copy={item.walletAddress} />
            ) : (
              <Row label="منشأ کریپتو" value="از فاکتور پرداخت‌شده — نزد بانک" />
            )}
            <Row label="حساب دریافت ریال" value={item.payoutAccount ?? "ثبت نشده"} copy={item.payoutAccount} />
            {item.bankWalletAddress ? (
              <Row
                label="آدرس والت بانک"
                value={truncateAddress(item.bankWalletAddress)}
                copy={item.bankWalletAddress}
              />
            ) : null}
            {item.userPayoutTxHash ? (
              <Row
                label="TX کاربر → بانک"
                value={truncateHash(item.userPayoutTxHash)}
                copy={item.userPayoutTxHash}
                link={explorerUrl(item.userPayoutTxHash)}
              />
            ) : null}
            {item.rialReceiptNo ? (
              <Row label="شماره فیش واریز" value={item.rialReceiptNo} copy={item.rialReceiptNo} />
            ) : null}
          </div>

          {item.status === "BANK_RATE_LOCKED" && item.bankWalletAddress && !item.sourceInvoiceId ? (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="font-medium text-sm">منتظر واریز کریپتو شما</div>
              <p className="text-xs text-muted-foreground">
                کریپتو را از والت شخصی خود به آدرس والت بانک ارسال کنید، سپس TX hash را اینجا ثبت کنید.
              </p>
              <div className="space-y-1.5">
                <Label>هش تراکنش (TX hash)</Label>
                <Input
                  value={txInput}
                  onChange={(e) => setTxInput(e.target.value)}
                  placeholder="0x..."
                  dir="ltr"
                  className="font-mono"
                />
              </div>
              <Button size="sm" className="w-full" onClick={handleSubmitTx}>
                <Send className="h-4 w-4" />
                ثبت TX hash
              </Button>
            </div>
          ) : null}

          {item.bankResponseNote ? (
            <div
              className={`rounded-md p-3 text-xs ${
                item.status === "REJECTED"
                  ? "bg-destructive/10 border border-destructive/30"
                  : "bg-info/10 border border-info/30"
              }`}
            >
              <div className="font-medium mb-1">پاسخ بانک</div>
              <p className="leading-6">{item.bankResponseNote}</p>
              {item.bankResponseAt ? (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  <JalaliDate iso={item.bankResponseAt} withTime />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-sm">{value}</div>
    </div>
  );
}

function Row({ label, value, copy, link }: { label: string; value: string; copy?: string; link?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener"
            className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-1"
            dir="ltr"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="font-mono text-xs" dir="ltr">{value}</span>
        )}
        {copy ? <CopyButton value={copy} label="" /> : null}
      </div>
    </div>
  );
}
