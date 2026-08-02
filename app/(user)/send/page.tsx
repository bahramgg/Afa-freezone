"use client";

import Link from "next/link";
import { Archive, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useSendStore } from "@/lib/stores/send";
import { useHydrated } from "@/lib/stores/hydration";
import { truncateAddress, truncateHash, bscScanUrl, toPersianDigits, formatAmount } from "@/lib/format";

/**
 * Retired. Imports are an invoice the foreign seller raises; see /imports.
 *
 * The list stays because retiring a payment flow cannot strand the requests
 * already inside it — a merchant with one in flight still needs to watch the
 * bank finish or reject it. Only the form is gone, and the API refuses new
 * requests regardless of what a client sends.
 */
export default function SendPage() {
  const list = useSendStore((s) => s.list);
  const hydrated = useHydrated();

  return (
    <div className="space-y-6">
      <PageHeader
        title="ارسال وجه (بازنشسته)"
        description="درخواست‌های ارسالی که پیش از بازنشستگی این مسیر ثبت شده‌اند"
      />

      {/* Retired: new requests are refused by the API. What is left here is the
          list, because a request already in flight still has to be watched
          through to the end. */}
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-warning" />
            این مسیر بازنشسته شده است
          </CardTitle>
          <CardDescription>
            واردات اکنون با فاکتوری انجام می‌شود که فروشندهٔ خارجی صادر می‌کند: شناسهٔ کاربری خود را
            به فروشنده بدهید، فاکتور در «واردات (فاکتور فروشنده)» برای شما می‌آید، معادل ریالی را به
            حساب بانک می‌ریزید و قرارداد تسویه، اصل مبلغ را به فروشنده و کارمزد را به درگاه و سازمان
            می‌رساند. درخواست‌های در جریانِ زیر تا پایان کار دنبال می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/imports">رفتن به واردات</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>درخواست‌های ارسال</CardTitle>
        </CardHeader>
        <CardContent>
          {!hydrated || list.length === 0 ? (
            <EmptyState title="درخواستی وجود ندارد" description="هنوز درخواست ارسالی ثبت نشده است" />
          ) : (
            <div className="space-y-3">
              {list.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{r.trxId}</span>
                        <SendStatusBadge status={r.status} />
                      </div>
                      <div className="text-sm">
                        به <span className="font-medium">{r.counterpartyName ?? r.counterpartyUid}</span>
                        <span className="text-xs text-muted-foreground"> ({r.counterpartyUid})</span>
                      </div>
                    </div>
                    <div className="text-end space-y-0.5">
                      <MoneyText amount={r.amount} currency={r.currency} className="text-base" />
                      <div className="text-xs text-muted-foreground">
                        <JalaliDate iso={r.createdAt} relative />
                      </div>
                    </div>
                  </div>

                  {r.exchangeRate ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-muted-foreground">نرخ ارز ({r.rateLocked ? <span className="text-success">قطعی</span> : <span className="text-warning">تخمینی</span>})</div>
                        <div className="font-medium">{toPersianDigits(formatAmount(r.exchangeRate))} ت</div>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-muted-foreground">معادل ریالی</div>
                        <div className="font-medium">{toPersianDigits(formatAmount(r.rialAmount ?? 0))} ت</div>
                      </div>
                    </div>
                  ) : null}

                  {r.status === "BANK_RATE_LOCKED" && r.depositAccount ? (
                    <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                      <div className="font-medium mb-1">منتظر واریز ریال شما</div>
                      <div className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">شماره حساب بانک:</span>
                        <span className="font-mono" dir="ltr">{r.depositAccount}</span>
                        <CopyButton value={r.depositAccount} />
                      </div>
                    </div>
                  ) : null}

                  {r.status === "CRYPTO_SENT" && r.txHashFromBank ? (
                    <div className="mt-3 rounded-md border border-info/30 bg-info/5 p-3 space-y-2 text-sm">
                      <div className="font-medium">کریپتو از بانک به والت شما رسید</div>
                      <div className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">TX:</span>
                        <a href={bscScanUrl(r.txHashFromBank)} target="_blank" rel="noreferrer" className="font-mono inline-flex items-center gap-1 hover:text-primary" dir="ltr">
                          {truncateHash(r.txHashFromBank)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {r.status === "PAID" && r.txHashFromBank ? (
                    <div className="mt-3 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">والت گیرنده:</span>
                        <span className="font-mono" dir="ltr">{truncateAddress(r.recipientWalletAddress ?? "")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">TX:</span>
                        <a href={bscScanUrl(r.txHashFromBank)} target="_blank" rel="noreferrer" className="font-mono inline-flex items-center gap-1 hover:text-primary" dir="ltr">
                          {truncateHash(r.txHashFromBank)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {r.status === "REJECTED" && r.rejectReason ? (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                      <div className="text-muted-foreground">دلیل رد ({r.rejectedBy === "BANK" ? "بانک" : "ادمین"}):</div>
                      <div>{r.rejectReason}</div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
