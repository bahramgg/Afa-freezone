"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2, Undo2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/shared/CopyButton";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { api, ApiClientError } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import type { Refund } from "@/lib/types";
import { ReleaseButton } from "@/components/bank/ReleaseButton";

/** Public chain id, safe in the bundle — it identifies a network, not a secret. */
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 56);
import { truncateAddress, truncateHash, toPersianDigits, formatAmount } from "@/lib/format";

/**
 * What buyers have paid, and where it is sitting.
 *
 * Each payment lands at an address derived for its own invoice, so the money
 * arrives spread across as many addresses as there were payments. The operator
 * moves each balance into the treasury with their own wallet — the gateway
 * holds no key to any of them — and records the hash here, which is what the
 * books are written from.
 */

type Split = {
  gateway: number | string;
  freezone: number | string;
  /** The remainder: the bank's treasury on an export, the seller on an import. */
  beneficiary: number | string;
};

type Deposit = {
  id: string;
  index: number;
  address: string;
  invoiceRef?: string;
  direction?: "EXPORT" | "IMPORT";
  currency: string;
  receivedAmount: number;
  released: boolean;
  releasedAt?: string;
  txHash?: string;
  terms?: unknown;
  /** What the contract would pay out, worked out the way it does. */
  preview?: Split;
  /** What it actually paid, read back from its own event. */
  split?: Split;
};

export default function DepositsPage() {
  const [list, setList] = useState<Deposit[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [hash, setHash] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [factory, setFactory] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [deposits, pending] = await Promise.all([
      api.get<{ list: Deposit[]; factory?: string }>("/deposits").catch(() => null),
      api.get<{ list: Refund[] }>("/refunds").catch(() => null),
    ]);
    if (deposits) {
      setList(deposits.list);
      setFactory(deposits.factory);
    }
    if (pending) setRefunds(pending.list.filter((r) => r.status === "APPROVED"));
  }, []);

  useLoad(load);

  async function sendRefund(ref: string) {
    const txHash = (hash[ref] ?? "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      toast.error("هش تراکنش معتبر نیست");
      return;
    }
    setBusy(ref);
    try {
      await api.patch("/refunds", { ref, action: "markSent", txHash });
      toast.success("بازگشت وجه ثبت و روی زنجیره تأیید شد");
      setHash((h) => ({ ...h, [ref]: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "ثبت انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  const pending = list.filter((d) => !d.released && d.receivedAmount > 0);
  const total = pending.reduce((sum, d) => sum + d.receivedAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="آدرس‌های واریز"
        description="وجوه دریافتی از خریداران و انتقال آن‌ها به خزانه بانک"
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">در انتظار تسویه</div>
              <div className="text-lg font-semibold">
                {toPersianDigits(formatAmount(total))} USDT
              </div>
            </div>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            هر تسویه یک تراکنش است که همان‌جا سه سهم را پرداخت می‌کند: کارمزد درگاه، سهم سازمان،
            و باقی به خزانهٔ بانک. مقصدها را خودِ آدرس تعیین می‌کند و قابل تغییر نیستند — شما فقط
            آن را با کیف پول خودتان امضا می‌کنید.
          </p>
        </CardContent>
      </Card>

      {refunds.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="text-sm font-semibold">بازگشت وجه‌های تأییدشده</div>
            <p className="text-xs text-muted-foreground">
              مقصد هر کدام آدرسی است که پرداخت از آن آمده — قابل تغییر نیست. انتقال را انجام دهید
              و هش را ثبت کنید.
            </p>
            {refunds.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-mono text-xs">{r.id}</span> ·{" "}
                  {toPersianDigits(formatAmount(r.amount))} {r.currency}
                  <div className="flex items-center gap-1.5">
                    <Ltr className="font-mono text-xs text-muted-foreground">
                      {truncateAddress(r.toAddress)}
                    </Ltr>
                    <CopyButton value={r.toAddress} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={hash[r.id] ?? ""}
                    onChange={(e) => setHash((h) => ({ ...h, [r.id]: e.target.value }))}
                    placeholder="0x…"
                    dir="ltr"
                    className="h-8 w-44 font-mono text-xs"
                  />
                  <Button size="sm" onClick={() => sendRefund(r.id)} disabled={busy === r.id}>
                    {busy === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="h-3.5 w-3.5" />
                    )}
                    ثبت
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">فاکتور</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">موجودی</th>
                  <th className="text-start font-medium px-4 py-3">تقسیم</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      هنوز آدرس واریزی ساخته نشده است
                    </td>
                  </tr>
                ) : (
                  list.map((d) => (
                    <tr key={d.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-mono text-xs">{d.invoiceRef ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ltr className="font-mono text-xs">{truncateAddress(d.address)}</Ltr>
                          <CopyButton value={d.address} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {toPersianDigits(formatAmount(d.receivedAmount))} {d.currency}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {(() => {
                          const s = d.split ?? d.preview;
                          if (!s) return <span className="text-muted-foreground">—</span>;
                          return (
                            <div className="space-y-0.5 whitespace-nowrap">
                              <div>درگاه {toPersianDigits(formatAmount(Number(s.gateway)))}</div>
                              <div>سازمان {toPersianDigits(formatAmount(Number(s.freezone)))}</div>
                              <div>
                                {d.direction === "IMPORT" ? "فروشنده" : "بانک"}{" "}
                                {toPersianDigits(formatAmount(Number(s.beneficiary)))}
                              </div>
                              {!d.split ? (
                                <div className="text-[10px] text-muted-foreground">پیش‌بینی</div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {d.released ? (
                          <div className="space-y-1">
                            <Badge tone="success">تقسیم شد</Badge>
                            {d.txHash ? (
                              <Ltr className="block font-mono text-[10px] text-muted-foreground">
                                {truncateHash(d.txHash)}
                              </Ltr>
                            ) : null}
                            <span className="block text-[10px] text-muted-foreground">
                              <JalaliDate iso={d.releasedAt ?? ""} />
                            </span>
                          </div>
                        ) : d.receivedAmount > 0 ? (
                          <Badge tone="warning">آمادهٔ تسویه</Badge>
                        ) : (
                          <Badge tone="info">در انتظار پرداخت</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!d.released && d.receivedAmount > 0 ? (
                          <ReleaseButton
                            depositId={d.id}
                            factory={factory}
                            terms={d.terms}
                            chainId={CHAIN_ID}
                            direction={d.direction}
                            onReleased={load}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
