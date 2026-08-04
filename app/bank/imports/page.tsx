"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Loader2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Ltr } from "@/components/shared/Ltr";
import { CopyButton } from "@/components/shared/CopyButton";
import { api } from "@/lib/api/client";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useSettingsStore } from "@/lib/stores/settings";
import { useLoad } from "@/lib/stores/useLoad";
import { formatAmount, toPersianDigits, truncateAddress } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { CancelImportDialog } from "@/components/invoice/CancelImportDialog";

/**
 * The bank's side of an import.
 *
 * Three things happen here in order: the invoice is priced in rial and an
 * account is named for the importer to pay into, the rial arriving is
 * confirmed, and then the bank sends the currency to the invoice's contract
 * address. That last step is a transfer from the bank's own wallet, signed
 * outside this system — nothing here holds a key, and it does not need one,
 * because the address decides where the money goes on its own.
 */
export default function BankImportsPage() {
  const lockRate = useInvoicesStore((s) => s.lockRate);
  const confirmRialDeposit = useInvoicesStore((s) => s.confirmRialDeposit);
  const cancelImport = useInvoicesStore((s) => s.cancelImport);
  const confirmRialReturn = useInvoicesStore((s) => s.confirmRialReturn);
  const reference = useSettingsStore((s) => s.settings.usdtRate);

  const [list, setList] = useState<Invoice[]>([]);
  const [rate, setRate] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const [returnReceipt, setReturnReceipt] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setList(data.list.filter((i) => i.tradeDirection === "IMPORT"));
  }, []);
  useLoad(load);

  async function run(id: string, action: () => Promise<void>, done: string) {
    setBusy(id);
    try {
      await action();
      await load();
      toast.success(done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  // CANCELLING is in the queue because it is work the bank still owes: the
  // importer's rial has not gone back yet, and nowhere else would show it.
  const waiting = list.filter((i) =>
    ["APPROVED", "BANK_RATE_LOCKED", "RIAL_RECEIVED", "CANCELLING"].includes(i.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="واردات — تأمین ارز"
        description="نرخ را قفل کنید، شماره حساب را به واردکننده بدهید، و پس از دریافت ریال ارز را به آدرس قرارداد بفرستید"
      />

      {waiting.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              title="فاکتور وارداتی در جریان نیست"
              description="فاکتورهای تأییدشدهٔ سازمان اینجا نمایش داده می‌شوند"
            />
          </CardContent>
        </Card>
      ) : null}

      {waiting.map((i) => {
        const gross = i.amount + (i.fee ?? 0);
        const typed = Number(rate[i.id]);
        const preview = typed > 0 ? gross * typed : null;

        return (
          <Card key={i.id}>
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">{i.id}</span>
                  <InvoiceStatusBadge status={i.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  <JalaliDate iso={i.createdAt} />
                </span>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">واردکننده</div>
                  <div>{i.counterpartyName ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">اصل مبلغ فروشنده</div>
                  <MoneyText amount={i.amount} currency={i.currency} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">کارمزد</div>
                  {i.fee != null ? <MoneyText amount={i.fee} currency={i.currency} /> : "—"}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ارز موردنیاز</div>
                  <MoneyText amount={gross} currency={i.currency} />
                </div>
              </div>

              {i.status === "APPROVED" ? (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <label htmlFor={`rate-${i.id}`} className="text-xs text-muted-foreground">نرخ هر واحد (ریال)</label>
                    <Input
                      id={`rate-${i.id}`}
                      inputMode="numeric"
                      dir="ltr"
                      className="font-mono"
                      placeholder={String(reference)}
                      value={rate[i.id] ?? ""}
                      onChange={(e) => setRate((s) => ({ ...s, [i.id]: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`account-${i.id}`} className="text-xs text-muted-foreground">
                      شماره حساب برای واریز واردکننده
                    </label>
                    <Input
                      id={`account-${i.id}`}
                      dir="ltr"
                      className="font-mono"
                      placeholder="IR…"
                      value={account[i.id] ?? ""}
                      onChange={(e) => setAccount((s) => ({ ...s, [i.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    disabled={busy === i.id || !(typed > 0) || !account[i.id]?.trim()}
                    onClick={() =>
                      run(
                        i.id,
                        () => lockRate(i.id, typed, account[i.id]!.trim()),
                        "نرخ قفل شد و شماره حساب برای واردکننده ارسال شد",
                      )
                    }
                  >
                    {busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    قفل نرخ
                  </Button>
                  {preview ? (
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      واردکننده {toPersianDigits(formatAmount(preview))} ریال می‌پردازد — معادل{" "}
                      {toPersianDigits(formatAmount(gross))} {i.currency}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {i.status === "BANK_RATE_LOCKED" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">نرخ قفل‌شده</div>
                      <div>
                        {i.exchangeRate
                          ? `${toPersianDigits(formatAmount(i.exchangeRate))} ریال`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">مبلغ ریالی</div>
                      <div>
                        {i.rialAmount ? `${toPersianDigits(formatAmount(i.rialAmount))} ریال` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">حساب اعلام‌شده</div>
                      <Ltr className="font-mono text-xs">{i.depositAccount ?? "—"}</Ltr>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <label htmlFor={`receipt-${i.id}`} className="text-xs text-muted-foreground">شماره رسید واریز ریالی</label>
                      <Input
                        id={`receipt-${i.id}`}
                        dir="ltr"
                        className="font-mono"
                        value={receipt[i.id] ?? ""}
                        onChange={(e) => setReceipt((s) => ({ ...s, [i.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      disabled={busy === i.id || !receipt[i.id]?.trim()}
                      onClick={() =>
                        run(
                          i.id,
                          () => confirmRialDeposit(i.id, receipt[i.id]!.trim()),
                          "واریز ریالی ثبت شد — حالا ارز را به آدرس قرارداد بفرستید",
                        )
                      }
                    >
                      {busy === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      تأیید دریافت ریال
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* A trader has asked for this to be called off. It is the bank's
                  decision because only the bank knows whether the currency has
                  already gone out — so it is shown before the "send it" panel,
                  not after. */}
              {i.cancelRequestedAt && !i.cancelledAt ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">درخواست لغو ثبت شده است</div>
                      <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
                        {i.cancelReason}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {i.status === "CANCELLING" ? (
                <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3">
                  <p className="text-sm font-medium">
                    این فاکتور لغو شده — ریال واردکننده باید بازگردانده شود
                  </p>
                  {i.rialAmount ? (
                    <p className="text-xs text-muted-foreground">
                      مبلغ دریافتی: {toPersianDigits(formatAmount(i.rialAmount))} ریال
                      {i.rialReceiptNo ? ` · رسید دریافت ${toPersianDigits(i.rialReceiptNo)}` : ""}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-48 flex-1 space-y-1">
                      <label htmlFor={`return-${i.id}`} className="text-xs text-muted-foreground">شمارهٔ رسید بازگشت</label>
                      <Input
                        id={`return-${i.id}`}
                        dir="ltr"
                        className="font-mono"
                        value={returnReceipt[i.id] ?? ""}
                        onChange={(e) =>
                          setReturnReceipt((s) => ({ ...s, [i.id]: e.target.value }))
                        }
                      />
                    </div>
                    <Button
                      disabled={busy === i.id || !returnReceipt[i.id]?.trim()}
                      onClick={() =>
                        run(
                          i.id,
                          () => confirmRialReturn(i.id, returnReceipt[i.id]!.trim()),
                          "بازگشت ریال ثبت شد — فاکتور بسته شد",
                        )
                      }
                    >
                      {busy === i.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      ثبت بازگشت ریال
                    </Button>
                  </div>
                </div>
              ) : null}

              {i.status === "RIAL_RECEIVED" ? (
                <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-3">
                  <p className="text-sm font-medium">
                    {toPersianDigits(formatAmount(gross))} {i.currency} را به این آدرس بفرستید
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Ltr className="font-mono text-sm">
                      {i.paymentAddress ? truncateAddress(i.paymentAddress, 10, 8) : "—"}
                    </Ltr>
                    {i.paymentAddress ? <CopyButton value={i.paymentAddress} /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ارسال از کیف پول خود بانک و بیرون از سامانه انجام می‌شود. پس از تأیید شبکه،
                    قرارداد اصل مبلغ را به فروشنده و کارمزد را به درگاه و سازمان تقسیم می‌کند و
                    وضعیت فاکتور خودکار به «پرداخت شده» تغییر می‌کند.
                  </p>
                </div>
              ) : null}

              {["BANK_RATE_LOCKED", "RIAL_RECEIVED"].includes(i.status) ? (
                <div className="flex justify-end border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancelling(i)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    لغو فاکتور
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {cancelling ? (
        <CancelImportDialog
          open
          onOpenChange={(open) => !open && setCancelling(null)}
          mode="cancel"
          invoiceRef={cancelling.id}
          rialHeld={cancelling.status === "RIAL_RECEIVED"}
          onConfirm={async (reason) => {
            await cancelImport(cancelling.id, reason);
            await load();
          }}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-6">
              <EmptyState title="فاکتور وارداتی ثبت نشده است" />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[54rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">شماره</th>
                    <th className="text-start font-medium px-4 py-3">فروشنده</th>
                    <th className="text-start font-medium px-4 py-3">واردکننده</th>
                    <th className="text-start font-medium px-4 py-3">ارز</th>
                    <th className="text-start font-medium px-4 py-3">ریال</th>
                    <th className="text-start font-medium px-4 py-3">حاشیه</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                      <td className="px-4 py-3">{i.userName ?? "—"}</td>
                      <td className="px-4 py-3">{i.counterpartyName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <MoneyText amount={i.amount + (i.fee ?? 0)} currency={i.currency} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {i.rialAmount ? `${toPersianDigits(formatAmount(i.rialAmount))} ریال` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {i.bankSpreadRial
                          ? `${toPersianDigits(formatAmount(i.bankSpreadRial))} ریال`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
