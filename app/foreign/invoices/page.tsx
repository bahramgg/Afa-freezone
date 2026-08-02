"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import type { Invoice } from "@/lib/types";

/**
 * Payment requests addressed to this buyer.
 *
 * An Iranian exporter raises an invoice against a buyer's account id, so this
 * is where it arrives. Paying happens on the payment page, which is the same
 * one the shared link opens.
 */
export default function ForeignInvoicesPage() {
  const [list, setList] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setList(data.list);
  }, []);
  useLoad(load);

  const payable = list.filter((i) => i.status === "APPROVED" || i.status === "PAYMENT_PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        title="درخواست‌های پرداخت"
        description="فاکتورهایی که فروشندگان ایرانی برای شما صادر کرده‌اند"
      />

      {payable.length > 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm">
              {payable.length} فاکتور در انتظار پرداخت شماست.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="فاکتوری برای شما صادر نشده است"
                description="شناسهٔ کاربری خود را به فروشنده بدهید تا فاکتور را برای شما صادر کند"
              />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">شماره</th>
                    <th className="text-start font-medium px-4 py-3">فروشنده</th>
                    <th className="text-start font-medium px-4 py-3">کالا</th>
                    <th className="text-start font-medium px-4 py-3">مبلغ</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ</th>
                    <th className="text-start font-medium px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                      <td className="px-4 py-3">{i.userName ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3">{i.goodsTitle}</td>
                      <td className="px-4 py-3">
                        <MoneyText amount={i.amount} currency={i.currency} />
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={i.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <JalaliDate iso={i.createdAt} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        {i.status === "APPROVED" || i.status === "PAYMENT_PENDING" ? (
                          <Button asChild size="sm">
                            <Link href={`/pay/${i.id}`}>
                              پرداخت
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : i.status === "PAID" ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/pay/${i.id}`}>
                              <FileText className="h-3.5 w-3.5" />
                              رسید
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
