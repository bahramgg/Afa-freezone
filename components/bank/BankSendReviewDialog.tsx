"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Coins, Lock, Send, XCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/Input";
import { MoneyText } from "@/components/shared/MoneyText";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { useSendStore } from "@/lib/stores/send";
import { useBankStore } from "@/lib/stores/bank";
import { useSettingsStore } from "@/lib/stores/settings";
import { truncateAddress, formatAmount, toPersianDigits } from "@/lib/format";
import type { SendRequest } from "@/lib/types";

type Props = {
  item: SendRequest | null;
  onOpenChange: (open: boolean) => void;
};

export function BankSendReviewDialog({ item, onOpenChange }: Props) {
  const lockRate = useSendStore((s) => s.lockBankRate);
  const confirmRial = useSendStore((s) => s.confirmRialDeposit);
  const recordCryptoSent = useSendStore((s) => s.recordCryptoSent);
  const rejectBank = useSendStore((s) => s.rejectBank);
  const wallets = useBankStore((s) => s.wallets);
  const settings = useSettingsStore((s) => s.settings);

  const [rate, setRate] = useState<number>(settings.usdtRate);
  const [depositAccount, setDepositAccount] = useState("IR84-0170-0000-0011-2233-44");
  const [receiptNo, setReceiptNo] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (item) {
      setRate(item.exchangeRate ?? (item.currency === "BNB" ? settings.bnbRate : settings.usdtRate));
      const send = wallets.find((w) => w.active && (w.kind === "SEND" || w.kind === "SHARED"));
      setWalletAddress(send?.address ?? wallets[0]?.address ?? "");
      setReceiptNo("");
      setTxHash("");
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
    lockRate(item!.id, rate, depositAccount);
    toast.success(`نرخ قفل شد: ${formatAmount(rate)} تومان`);
    onOpenChange(false);
  }

  function handleConfirmRial() {
    if (!receiptNo) {
      toast.error("شماره فیش را وارد کنید");
      return;
    }
    confirmRial(item!.id, receiptNo);
    toast.success("واریز ریال تأیید شد");
    onOpenChange(false);
  }

  async function handleSendCrypto() {
    if (!walletAddress) {
      toast.error("کیف پول مبدأ را انتخاب کنید");
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())) {
      toast.error("هش تراکنش معتبر نیست");
      return;
    }
    try {
      // The transfer is signed outside the system; what registers it here is
      // the chain agreeing on recipient, currency and amount.
      await recordCryptoSent(item!.id, txHash.trim(), walletAddress);
      toast.success("تراکنش روی شبکه راستی‌آزمایی و ثبت شد");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت تراکنش ناموفق بود");
    }
  }

  function handleReject() {
    if (!rejectReason) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    rejectBank(item!.id, rejectReason);
    toast.error("درخواست رد شد");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>بررسی درخواست ارسال وجه — {item.trxId}</DialogTitle>
          <DialogDescription>
            <SendStatusBadge status={item.status} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
            <Info label="کاربر ایرانی" value={`${item.userName ?? "—"} (${item.userUid ?? "—"})`} />
            <Info label="کاربر خارجی" value={`${item.counterpartyName ?? "—"} (${item.counterpartyUid})`} />
            <Info label="مبلغ کریپتو" value={<MoneyText amount={item.amount} currency={item.currency} />} />
            <Info
              label="نرخ ارز"
              value={
                <span className={item.rateLocked ? "text-success" : "text-muted-foreground"}>
                  {toPersianDigits(formatAmount(item.exchangeRate ?? 0))} ت{" "}
                  <span className="text-xs">({item.rateLocked ? "قطعی" : "تخمینی"})</span>
                </span>
              }
            />
            <Info label="معادل ریالی" value={`${toPersianDigits(formatAmount(item.rialAmount ?? 0))} ت`} />
            <Info
              label="والت گیرنده"
              value={
                <span className="font-mono text-xs flex items-center gap-1" dir="ltr">
                  {truncateAddress(item.recipientWalletAddress ?? "")}
                  {item.recipientWalletAddress ? <CopyButton value={item.recipientWalletAddress} /> : null}
                </span>
              }
            />
            <Info label="توضیحات" value={item.description ?? "—"} full />
          </div>

          {rejectMode ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label>دلیل رد</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="دلیل رد را وارد کنید"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setRejectMode(false)}>انصراف</Button>
                <Button variant="destructive" size="sm" onClick={handleReject}>
                  <XCircle className="h-4 w-4" />
                  رد نهایی
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "AWAITING_BANK_REVIEW" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-info" />
                مرحله ۱ — اعلام نرخ و حساب
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
                  <Label>شماره حساب بانک</Label>
                  <Input
                    value={depositAccount}
                    onChange={(e) => setDepositAccount(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {stage === "BANK_RATE_LOCKED" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-info" />
                مرحله ۲ — تأیید واریز ریال
              </div>
              <div className="space-y-1.5">
                <Label>شماره فیش واریز</Label>
                <Input
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="TR-XX-XXXX"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  مبلغ مورد انتظار: {toPersianDigits(formatAmount(item.rialAmount ?? 0))} تومان
                </p>
              </div>
            </div>
          ) : null}

          {stage === "RIAL_RECEIVED" && !rejectMode ? (
            <div className="rounded-md border border-info/30 bg-info/5 p-4 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-info" />
                مرحله ۳ — ارسال کریپتو
              </div>
              <div className="space-y-1.5">
                <Label>کیف پول بانک (مبدأ)</Label>
                <select
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono"
                >
                  {wallets.filter((w) => w.active && (w.kind === "SEND" || w.kind === "SHARED")).map((w) => (
                    <option key={w.address} value={w.address}>
                      {w.label} — موجودی: {w.usdtBalance} USDT
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  مقصد: <span className="font-mono" dir="ltr">{truncateAddress(item.recipientWalletAddress ?? "")}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>هش تراکنش انجام‌شده</Label>
                <Input
                  dir="ltr"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  انتقال را از کیف پول بانک انجام دهید و هش آن را اینجا وارد کنید؛ سامانه
                  مبلغ و گیرنده را روی شبکه راستی‌آزمایی می‌کند.
                </p>
              </div>
            </div>
          ) : null}

          {stage === "CRYPTO_SENT" && !rejectMode ? (
            <div className="rounded-md border border-success/30 bg-success/5 p-4 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                کریپتو ارسال شد — منتظر تأیید نهایی کاربر ایرانی
              </div>
              <p className="text-xs text-muted-foreground">
                تراکنش ثبت شد و در حال دریافت تأییدیه‌های شبکه است. با رسیدن به حد نصاب،
                وضعیت به‌صورت خودکار «موفق» می‌شود.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {!rejectMode ? (
            <Button variant="destructive" onClick={() => setRejectMode(true)}>
              <XCircle className="h-4 w-4" />
              رد درخواست
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>بستن</Button>
          {!rejectMode && stage === "AWAITING_BANK_REVIEW" ? (
            <Button onClick={handleLockRate} className="bg-emerald-700 hover:bg-emerald-600">
              <Coins className="h-4 w-4" />
              تأیید و قفل نرخ
            </Button>
          ) : null}
          {!rejectMode && stage === "BANK_RATE_LOCKED" ? (
            <Button onClick={handleConfirmRial} className="bg-info hover:bg-info/90">
              <Lock className="h-4 w-4" />
              تأیید واریز ریال
            </Button>
          ) : null}
          {!rejectMode && stage === "RIAL_RECEIVED" ? (
            <Button onClick={handleSendCrypto} className="bg-info hover:bg-info/90">
              <Send className="h-4 w-4" />
              ثبت و راستی‌آزمایی تراکنش
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
