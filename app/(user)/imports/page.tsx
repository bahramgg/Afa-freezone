"use client";

import { useCallback, useState } from "react";
import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Ltr } from "@/components/shared/Ltr";
import { CopyButton } from "@/components/shared/CopyButton";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { formatAmount, toPersianDigits } from "@/lib/format";
import type { Invoice } from "@/lib/types";

/**
 * What a foreign seller has billed this importer, and what it costs in rial.
 *
 * The importer never touches currency. The bank buys it on their behalf and
 * pays the settlement contract; all the importer does is pay rial into the
 * account the bank names here. The rial figure covers the seller's price and
 * the fee together — the fee is added on top of the seller's price rather than
 * taken out of it, so it cannot go missing between the two.
 */
export default function ImportsPage() {
  const [list, setList] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setList(data.list.filter((i) => i.tradeDirection === "IMPORT"));
  }, []);
  useLoad(load);

  const payable = list.filter((i) => i.status === "BANK_RATE_LOCKED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="واردات — فاکتورهای فروشندگان خارجی"
        description="فاکتور را فروشندهٔ خارجی صادر می‌کند؛ شما معادل ریالی را به حساب بانک می‌ریزید و بانک ارز را تأمین می‌کند"
      />

      {payable.map((i) => (
        <Card key={i.id} className="border-primary/40">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="h-4 w-4 text-primary" />
              فاکتور {i.id} در انتظار واریز ریالی شماست
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">مبلغ ارزی (اصل + کارمزد)</div>
                <div>
                  <MoneyText amount={i.amount + (i.fee ?? 0)} currency={i.currency} />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">نرخ بانک</div>
                <div>
                  {i.exchangeRate ? `${toPersianDigits(formatAmount(i.exchangeRate))} ریال` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">مبلغ قابل واریز</div>
                <div className="font-medium">
                  {i.rialAmount ? `${toPersianDigits(formatAmount(i.rialAmount))} ریال` : "—"}
                </div>
              </div>
            </div>
            {i.depositAccount ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">شماره حساب بانک:</span>
                <Ltr className="font-mono text-sm">{i.depositAccount}</Ltr>
                <CopyButton value={i.depositAccount} />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              پس از واریز، بانک رسید را ثبت می‌کند و ارز را به قرارداد تسویه می‌فرستد. اصل مبلغ به
              فروشنده و کارمزد به درگاه و سازمان می‌رسد.
            </p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="فاکتور وارداتی برای شما صادر نشده است"
                description="شناسهٔ کاربری خود را به فروشندهٔ خارجی بدهید تا فاکتور را برای شما صادر کند"
              />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[58rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">شماره</th>
                    <th className="text-start font-medium px-4 py-3">فروشنده</th>
                    <th className="text-start font-medium px-4 py-3">کالا</th>
                    <th className="text-start font-medium px-4 py-3">اصل مبلغ</th>
                    <th className="text-start font-medium px-4 py-3">کارمزد</th>
                    <th className="text-start font-medium px-4 py-3">معادل ریالی</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                      <td className="px-4 py-3">
                        <div>{i.userName ?? "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {i.userUid}
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">{i.goodsTitle}</td>
                      <td className="px-4 py-3">
                        <MoneyText amount={i.amount} currency={i.currency} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {i.fee != null ? <MoneyText amount={i.fee} currency={i.currency} /> : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {i.rialAmount
                          ? `${toPersianDigits(formatAmount(i.rialAmount))} ریال`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={i.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <JalaliDate iso={i.createdAt} />
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
