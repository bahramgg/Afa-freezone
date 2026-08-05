"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { toPersianDigits, truncateAddress, truncateHash } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { explorerUrl } from "@/lib/chains";

export function TransactionDetailModal({
  tx,
  open,
  onOpenChange,
}: {
  tx: Transaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!tx) return null;
  const Status = tx.status === "CONFIRMED" ? CheckCircle2 : tx.status === "PENDING" ? Clock : XCircle;
  const statusColor =
    tx.status === "CONFIRMED" ? "text-success" : tx.status === "PENDING" ? "text-warning-foreground" : "text-destructive";

  const txTypeLabel = tx.direction === "RECEIVE" ? "واردات" : "صادرات";
  const counterpartyLabel = tx.direction === "RECEIVE" ? "طرف صادر کننده" : "طرف وارد کننده";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>جزئیات تراکنش {tx.trxId ?? tx.invoiceId ?? tx.id}</DialogTitle>
          <DialogDescription>
            وضعیت کامل و اطلاعات بلاکچین این تراکنش
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="نوع تراکنش" value={txTypeLabel} />
            <Field
              label="مبلغ"
              value={<MoneyText amount={tx.amount} currency={tx.currency} />}
            />
            <Field
              label="وضعیت"
              value={
                <span className={`inline-flex items-center gap-1.5 ${statusColor}`}>
                  <Status className="h-4 w-4" />
                  {tx.status === "CONFIRMED" ? "تأیید شده" : tx.status === "PENDING" ? "در انتظار" : "ناموفق"}
                </span>
              }
            />
            <Field label="تأییدیه‌ها" value={toPersianDigits(tx.confirmations)} />
            <Field
              label="تاریخ"
              value={<JalaliDate iso={tx.createdAt} withTime />}
            />
            <Field
              label="کارمزد"
              value={<MoneyText amount={tx.fee} currency={tx.currency} />}
            />
          </div>

          <div className="space-y-2 text-sm">
            <Row label="از آدرس" value={truncateAddress(tx.fromAddress)} copy={tx.fromAddress} />
            <Row label="به آدرس" value={truncateAddress(tx.toAddress)} copy={tx.toAddress} />
            <Row label="هش تراکنش" value={truncateHash(tx.txHash)} copy={tx.txHash} link={explorerUrl(tx.txHash)} />
          </div>

          {tx.counterpartyName ? (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="text-muted-foreground text-xs">{counterpartyLabel}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span>{tx.counterpartyName}</span>
                <span className="text-xs text-muted-foreground">{tx.counterpartyUid}</span>
              </div>
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
      <div className="mt-1 font-medium">{value}</div>
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
            className="text-primary hover:underline font-mono text-xs"
          >
            {value}
          </a>
        ) : (
          <span className="font-mono text-xs">{value}</span>
        )}
        {copy ? <CopyButton value={copy} label="" /> : null}
      </div>
    </div>
  );
}
