"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Coins, Receipt, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { InvoiceStatusBadge, SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useBankStore } from "@/lib/stores/bank";
import { useLoad } from "@/lib/stores/useLoad";
import { api } from "@/lib/api/client";
import { useHydrated } from "@/lib/stores/hydration";
import { monthlyTotals } from "@/lib/series";
import { toPersianDigits, formatAmount, formatToken } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export default function BankDashboardPage() {
  const [imports, setImports] = useState<Invoice[]>([]);
  const settlements = useSettlementsStore((s) => s.list);
  const wallets = useBankStore((s) => s.wallets);
  const hydrated = useHydrated();

  const loadImports = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setImports(data.list.filter((i) => i.tradeDirection === "IMPORT"));
  }, []);
  useLoad(loadImports);

  // Waiting on the bank specifically: one to price, the other to fund.
  const pendingImports = imports.filter(
    (i) => i.status === "APPROVED" || i.status === "RIAL_RECEIVED",
  ).length;
  const pendingSettlement = settlements.filter((s) => s.status === "AWAITING_BANK").length;

  /**
   * Counted from the imports and settlements this page already loads. It used
   * to come from a fixtures file, and so did the exchange-rate chart that stood
   * beside it — which is gone rather than filled in, because the system keeps
   * no rate history to draw one from.
   */
  const volumeData = useMemo(
    () =>
      monthlyTotals(
        [...imports, ...settlements],
        {
          send: (r) => ("tradeDirection" in r ? Math.round((r.rialAmount ?? 0) / 1_000_000) : 0),
          settle: (r) => ("tradeDirection" in r ? 0 : Math.round((r.rialAmount ?? 0) / 1_000_000)),
        },
        6,
      ),
    [imports, settlements],
  );

  const totalUsdt = wallets.reduce((a, w) => a + w.usdtBalance, 0);
  const totalNative = wallets.reduce((a, w) => a + w.bnbBalance, 0);
  // The current month is the last bucket, in million toman like the chart.
  const thisMonth = volumeData.at(-1);
  const monthVolume = (thisMonth?.send ?? 0) + (thisMonth?.settle ?? 0);

  const recentActivity = [
    ...imports
      .filter((i) => ["APPROVED", "BANK_RATE_LOCKED", "RIAL_RECEIVED", "PAYMENT_PENDING", "PAID"].includes(i.status))
      .slice(0, 3)
      .map((i) => ({
        type: "import" as const,
        trx: i.trxId,
        user: i.counterpartyName ?? i.userName,
        amount: i.amount + (i.fee ?? 0),
        currency: i.currency,
        status: i.status,
        createdAt: i.createdAt,
      })),
    ...settlements
      .filter((s) => ["AWAITING_BANK", "BANK_RATE_LOCKED", "CRYPTO_RECEIVED", "CRYPTO_CONFIRMED", "SETTLED"].includes(s.status))
      .slice(0, 3)
      .map((s) => ({
        type: "settle" as const,
        trx: s.trxId,
        user: s.userName,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        createdAt: s.createdAt,
      })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="داشبورد بانک" description="نمای کلی عملیات بانکی در لحظه" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="واردات در انتظار"
          value={hydrated ? toPersianDigits(pendingImports) : "—"}
          icon={Receipt}
          tone="success"
          hint="نیاز به بررسی"
        />
        <StatCard
          label="تسویه در انتظار"
          value={hydrated ? toPersianDigits(pendingSettlement) : "—"}
          icon={Banknote}
          tone="success"
          hint="نیاز به بررسی"
        />
        <StatCard
          label="حجم عملیات ماه"
          value={hydrated ? `${toPersianDigits(formatAmount(monthVolume))} میلیون ت` : "—"}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="موجودی USDT"
          value={hydrated ? formatToken(totalUsdt, "USDT") : "—"}
          icon={Wallet}
          tone="success"
          hint={hydrated ? formatToken(totalNative, "BNB") : ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>واردات در انتظار</CardTitle>
            <span className="text-2xl font-bold text-emerald-700">{hydrated ? toPersianDigits(pendingImports) : "—"}</span>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-600">
              <Link href="/bank/imports">مشاهده صف</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>تسویه در انتظار</CardTitle>
            <span className="text-2xl font-bold text-emerald-700">{hydrated ? toPersianDigits(pendingSettlement) : "—"}</span>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-600">
              <Link href="/bank/settlement">مشاهده صف</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>حجم عملیات ۶ ماه گذشته (میلیون تومان)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                    formatter={((v: unknown, name: unknown) => [
                      toPersianDigits(Number(v)) + " م.ت",
                      name === "send" ? "واردات" : "تسویه",
                    ]) as never}
                  />
                  <Bar dataKey="send" fill="oklch(0.55 0.18 240)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="settle" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آخرین عملیات بانکی</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-start font-medium py-2">نوع</th>
                  <th className="text-start font-medium py-2">TRX</th>
                  <th className="text-start font-medium py-2">کاربر</th>
                  <th className="text-start font-medium py-2">مبلغ</th>
                  <th className="text-start font-medium py-2">وضعیت</th>
                  <th className="text-start font-medium py-2">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      عملیاتی برای نمایش نیست
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((a, i) => (
                    <tr key={`${a.type}-${a.trx}-${i}`} className="border-b border-border last:border-0">
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 ${a.type === "import" ? "text-info" : "text-success"}`}>
                          {a.type === "import" ? <Receipt className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
                          {a.type === "import" ? "واردات" : "تسویه"}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-xs">{a.trx}</td>
                      <td className="py-2.5">{a.user ?? "—"}</td>
                      <td className="py-2.5"><MoneyText amount={a.amount} currency={a.currency} /></td>
                      <td className="py-2.5">
                        {a.type === "import" ? (
                          <InvoiceStatusBadge status={a.status as any} />
                        ) : (
                          <SettlementStatusBadge status={a.status as any} />
                        )}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        <JalaliDate iso={a.createdAt} relative />
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
