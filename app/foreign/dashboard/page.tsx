"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ChevronLeft, FileText, Receipt, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api/client";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits } from "@/lib/format";
import type { Invoice } from "@/lib/types";

/**
 * A foreign account has two sides, and both are invoices.
 *
 * Exports come to them to pay; imports are the ones they raised and will be
 * paid for. This used to be built on the send flow, which is gone — and with it
 * the only thing on the page that was not an invoice.
 */
export default function ForeignDashboardPage() {
  const user = useForeignStore((s) => s.user);
  const wallets = useForeignStore((s) => s.wallets);
  const hydrated = useHydrated();
  const [list, setList] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setList(data.list);
  }, []);
  useLoad(load);

  const toPay = list.filter((i) => i.tradeDirection !== "IMPORT" && i.counterpartyUid === user?.uid);
  const mySales = list.filter((i) => i.tradeDirection === "IMPORT" && i.userUid === user?.uid);

  const received = mySales
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.amount, 0);
  const awaitingPayment = toPay.filter((i) => i.status === "APPROVED" || i.status === "PAYMENT_PENDING").length;
  const salesInFlight = mySales.filter((i) => i.status !== "PAID" && i.status !== "REJECTED" && i.status !== "EXPIRED").length;

  const recent = [...toPay, ...mySales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="داشبورد" description={`Welcome, ${user?.fullName ?? "Partner"}`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="دریافتی از فروش"
          value={<MoneyText amount={received} currency="USDT" />}
          icon={ArrowDownLeft}
        />
        <StatCard
          label="فاکتورهای در انتظار پرداخت شما"
          value={hydrated ? toPersianDigits(awaitingPayment) : "—"}
          icon={FileText}
        />
        <StatCard
          label="فاکتورهای فروش در جریان"
          value={hydrated ? toPersianDigits(salesInFlight) : "—"}
          icon={Receipt}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>آخرین فاکتورها</CardTitle>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/foreign/invoices" className="gap-1">
                مشاهده همه
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start font-medium py-2">شماره</th>
                    <th className="text-start font-medium py-2">نوع</th>
                    <th className="text-start font-medium py-2">طرف مقابل</th>
                    <th className="text-start font-medium py-2">مبلغ</th>
                    <th className="text-start font-medium py-2">وضعیت</th>
                    <th className="text-start font-medium py-2">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                        فاکتوری برای نمایش وجود ندارد
                      </td>
                    </tr>
                  ) : (
                    recent.map((i) => {
                      const mine = i.userUid === user?.uid;
                      return (
                        <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 font-mono text-xs">{i.id}</td>
                          <td className="py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                            {mine ? "فروش" : "پرداخت"}
                          </td>
                          <td className="py-2.5">{(mine ? i.counterpartyName : i.userName) ?? "—"}</td>
                          <td className="py-2.5">
                            <MoneyText amount={i.amount} currency={i.currency} />
                          </td>
                          <td className="py-2.5">
                            <InvoiceStatusBadge status={i.status} />
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            <JalaliDate iso={i.createdAt} relative />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>دسترسی سریع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">شناسه</span>
              <span className="font-mono text-sm">{user?.uid ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">KYC</span>
              <Badge tone="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">والت‌ها</span>
              <span className="text-sm">{hydrated ? toPersianDigits(wallets.length) : "—"}</span>
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/foreign/invoices">
                  در انتظار پرداخت: {hydrated ? toPersianDigits(awaitingPayment) : "—"}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/foreign/imports">فاکتورهای فروش</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
