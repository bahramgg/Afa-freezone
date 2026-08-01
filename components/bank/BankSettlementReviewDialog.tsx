"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Coins, ExternalLink, Lock, Wallet, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MoneyText } from "@/components/shared/MoneyText";
import { SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useBankStore } from "@/lib/stores/bank";
import { useSettingsStore } from "@/lib/stores/settings";
import {
  truncateAddress,
  truncateHash,
  bscScanUrl,
  formatAmount,
  toPersianDigits,
} from "@/lib/format";
import type { Settlement } from "@/lib/types";

type Props = { item: Settlement | null; onOpenChange: (open: boolean) => void };

export function BankSettlementReviewDialog({ item, onOpenChange }: Props) {
  const lockRate = useSettlementsStore((s) => s.lockBankRate);
  const settle = useSettlementsStore((s) => s.settle);
  const bankReject = useSettlementsStore((s) => s.bankReject);
  const wallets = useBankStore((s) => s.wallets);
  const settings = useSettingsStore((s) => s.settings);

  const [rate, setRate] = useState<number>(settings.usdtRate);
  const [walletAddress, setWalletAddress] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (item) {
      setRate(item.exchangeRate ?? (item.currency === "BNB" ? settings.bnbRate : settings.usdtRate));
      const recv = wallets.find((w) => w.active && (w.kind === "RECEIVE" || w.kind === "SHARED"));
      setWalletAddress(recv?.address ?? wallets[0]?.address ?? "");
      setReceiptNo("");
      setRejectMode(false);
      setRejectReason("");
    }
  }, [item, wallets, settings]);

  if (!item) return null;

  const stage = item.status;

  function handleLockRate() {
    if (!rate || rate <= 0) {
      toast.error("نرخ معتبر را وارد کنید");
      return;
    }
    if (!walletAddress) {
      toast.error("کیف پول دریافت را انتخاب کنید");
      return;
    }
    lockRate(item!.id, rate, walletAddress);
    toast.success("نرخ قفل شد و آدرس والت به کاربر اعلام شد");
    onOpenChange(false);
  }

  function handleSettle() {
    if (!receiptNo) {
      toast.error("شماره فیش را وارد کنید");
      return;
    }
    settle(item!.id, receiptNo);
    toast.success(`تسویه ${item!.trxId} با موفقیت انجام شد`);
    onOpenChange(false);
  }

  function handleReject() {
    if (!rejectReason) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    bankReject(item!.id, rejectReason);
    toast.error("درخواست رد شد");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>بررسی درخواست تسویه — {item.trxId} ({item.id})</DialogTitle>
          <DialogDescription>
            <SettlementStatusBadge status={item.status} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
            <Info label="کاربر" value={`${item.userName ?? "—"} (${item.userUid ?? "—"})`} />
            <Info label="مشخصات کالا" value={item.goodsTitle} />
            <Info label="مبلغ کریپتو" value={<MoneyText amount={item.amount} currency={item.currency} />} />
            <Info
              label="نرخ ارز"
              value={
                <span className={item.rateLocked ? "text-success" : "text-muted-foreground"}>
                  {toPersianDigits(formatAmount(item.exchangeRate ?? 0))} ت ({item.rateLocked ? "قطعی" : "تخمینی"})
                </span>
              }
            />
            <Info label="معادل ریالی" value={`${toPersianDigits(formatAmount(item.rialAmount ?? 0))} ت`} />
            <Info label="شماره حساب" value={<span className="font-mono text-xs" dir="ltr">{item.bankAccount}</span>} />
            <Info
              label="هش تراکنش کریپتوی دریافتی کاربر"
              value={
                item.txHash ? (
                  <a href={bscScanUrl(item.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-primary" dir="ltr">
                    {truncateHash(item.txHash)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : "—"
              }
            />
            <Info label="آدرس والت کاربر" value={<span className="font-mono text-xs" dir="ltr">{truncateAddress(item.walletAddress)}</span>} />
            <Info label="توضیحات" value={item.description} full />
            {item.userPayoutTxHash ? (
              <Info
                label="هش تراکنش کاربر → بانک"
                value={
                  <a href={bscScanUrl(item.userPayoutTxHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-primary" dir="ltr">
                    {truncateHash(item.userPayoutTxHash)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
            ) : null}
          </div>

          {rejectMode ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label>دلیل رد</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setRejectMode(false)}>انصراف</Button>
                <Button variant="destructive" size="sm" onClick={handleReject}>
                  <XCircle className="h-4 w-4" />
                  رد نهایی
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "AWAITING_BANK" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-info" />
                مرحله ۱ — اعلام نرخ و والت دریافت
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>نرخ ارز روز (تومان)</Label>
                  <Input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>کیف پول بانک (دریافت)</Label>
                  <select
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono"
                  >
                    {wallets.filter((w) => w.active && (w.kind === "RECEIVE" || w.kind === "SHARED")).map((w) => (
                      <option key={w.address} value={w.address}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "BANK_RATE_LOCKED" && !rejectMode ? (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-4 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-warning" />
                منتظر ارسال کریپتو توسط کاربر
              </div>
              <p className="text-xs text-muted-foreground">
                وقتی کاربر TX hash را ارسال کند، اینجا نمایش داده می‌شود.
              </p>
            </div>
          ) : null}

          {stage === "CRYPTO_RECEIVED" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-info" />
                مرحله ۲ — تأیید TX hash روی بلاکچین
              </div>
              <div className="rounded-md bg-background p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TX hash:</span>
                  <a
                    href={item.userPayoutTxHash ? bscScanUrl(item.userPayoutTxHash) : "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono inline-flex items-center gap-1 hover:text-primary"
                    dir="ltr"
                  >
                    {item.userPayoutTxHash ? truncateHash(item.userPayoutTxHash) : "—"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "CRYPTO_CONFIRMED" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-info" />
                مرحله ۳ — ثبت واریز ریال نهایی
              </div>
              <div className="space-y-1.5">
                <Label>شماره فیش واریز</Label>
                <Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="TR-XX-XXXX" dir="ltr" />
                <p className="text-xs text-muted-foreground">
                  مبلغ: {toPersianDigits(formatAmount(item.rialAmount ?? 0))} تومان به حساب{" "}
                  <span className="font-mono" dir="ltr">{item.bankAccount}</span>
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {!rejectMode && stage !== "SETTLED" && stage !== "REJECTED" ? (
            <Button variant="destructive" onClick={() => setRejectMode(true)}>
              <XCircle className="h-4 w-4" />
              رد درخواست
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>بستن</Button>
          {!rejectMode && stage === "AWAITING_BANK" ? (
            <Button onClick={handleLockRate} className="bg-emerald-700 hover:bg-emerald-600">
              <Coins className="h-4 w-4" />
              تأیید و اعلام
            </Button>
          ) : null}
          {/* CRYPTO_RECEIVED advances on its own: the transfer was already
              verified on chain when the merchant submitted it, and the watcher
              promotes it to CRYPTO_CONFIRMED once it has enough confirmations. */}
          {!rejectMode && stage === "CRYPTO_CONFIRMED" ? (
            <Button onClick={handleSettle} className="bg-emerald-700 hover:bg-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              ثبت واریز نهایی
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
