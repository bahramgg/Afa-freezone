"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Ltr } from "@/components/shared/Ltr";
import { CopyButton } from "@/components/shared/CopyButton";
import { CreateImportInvoiceDialog } from "@/components/invoice/CreateImportInvoiceDialog";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useLoad } from "@/lib/stores/useLoad";
import { truncateAddress } from "@/lib/format";
import type { Invoice } from "@/lib/types";

/**
 * What this seller has billed Iranian importers.
 *
 * The seller is paid in currency by the settlement contract, so once an invoice
 * reaches PAID there is nothing further for them to do — no rial, no bank, no
 * settlement request. What they watch here is the invoice working its way
 * through the organization, the bank and the importer's rial payment.
 */
export default function ForeignImportsPage() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [list, setList] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    // The same endpoint carries invoices raised *against* this account too;
    // those belong on the payment-requests page.
    setList(data.list.filter((i) => i.tradeDirection === "IMPORT"));
  }, []);
  useLoad(load);

  const mine = list.filter((i) => i.userUid === uid);

  return (
    <div className="space-y-6">
      <PageHeader
        title="فاکتورهای فروش"
        description="فاکتورهایی که برای واردکنندگان ایرانی صادر کرده‌اید — اصل مبلغ مستقیماً به کیف پول شما واریز می‌شود"
        actions={<CreateImportInvoiceDialog />}
      />

      <Card>
        <CardContent className="p-0">
          {mine.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="هنوز فاکتور فروشی صادر نکرده‌اید"
                description="شناسهٔ واردکنندهٔ ایرانی را بگیرید و فاکتور را صادر کنید"
              />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">شماره</th>
                    <th className="text-start font-medium px-4 py-3">واردکننده</th>
                    <th className="text-start font-medium px-4 py-3">کالا</th>
                    <th className="text-start font-medium px-4 py-3">سهم شما</th>
                    <th className="text-start font-medium px-4 py-3">کارمزد</th>
                    <th className="text-start font-medium px-4 py-3">کیف پول دریافت</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((i) => (
                    <tr key={i.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                      <td className="px-4 py-3">
                        <div>{i.counterpartyName ?? "—"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {i.counterpartyUid}
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">{i.goodsTitle}</td>
                      <td className="px-4 py-3">
                        <MoneyText amount={i.amount} currency={i.currency} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {i.fee != null ? <MoneyText amount={i.fee} currency={i.currency} /> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {i.beneficiaryWallet ? (
                          <div className="flex items-center gap-1.5">
                            <Ltr className="font-mono text-xs">
                              {truncateAddress(i.beneficiaryWallet)}
                            </Ltr>
                            <CopyButton value={i.beneficiaryWallet} />
                          </div>
                        ) : (
                          "—"
                        )}
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
