"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportExcelButton } from "@/components/shared/ExportExcelButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import type { Invoice } from "@/lib/types";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { currencySplit, monthlyTotals, outcomeSplit } from "@/lib/series";
import { currencyLabel } from "@/lib/chains";
import { useInToken } from "@/lib/value";
import { toPersianDigits, formatAmount } from "@/lib/format";

const STATUS_COLORS = ["oklch(0.55 0.2 145)", "oklch(0.75 0.18 80)", "oklch(0.55 0.22 25)"];
const CURRENCY_COLORS = ["oklch(0.55 0.18 240)", "oklch(0.75 0.18 80)"];

export default function BankReportsPage() {
  const settlements = useSettlementsStore((s) => s.list);
  const [imports, setImports] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setImports(data.list.filter((i) => i.tradeDirection === "IMPORT"));
  }, []);
  useLoad(load);

  const inToken = useInToken();

  /**
   * Counted from the rows this page already loads. All of it used to come from
   * a fixtures file — six fixed month names and a made-up curve — on a page the
   * bank reads as a report.
   */
  const monthVolume = useMemo(
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

  const cryptoMonthly = useMemo(
    () =>
      monthlyTotals(
        [...imports, ...settlements],
        {
          send: (r) =>
            "tradeDirection" in r ? inToken(r.amount + (r.fee ?? 0), r.currency) : 0,
          receive: (r) => ("tradeDirection" in r ? 0 : inToken(r.amount, r.currency)),
        },
        6,
      ),
    [imports, settlements, inToken],
  );

  // The rial the bank took from importers, against currency it supplied.
  const sendVolumeRial = imports
    .filter((i) => i.status === "PAID")
    .reduce((a, i) => a + (i.rialAmount ?? 0), 0);
  const settleVolumeRial = settlements
    .filter((s) => s.status === "SETTLED")
    .reduce((a, s) => a + (s.rialAmount ?? 0), 0);
  const cryptoSent = imports
    .filter((i) => i.status === "PAID" || i.status === "PAYMENT_PENDING")
    .reduce((a, i) => a + inToken(i.amount + (i.fee ?? 0), i.currency), 0);
  const cryptoReceived = settlements
    .filter((s) => s.status === "SETTLED" || s.status === "CRYPTO_CONFIRMED")
    .reduce((a, s) => a + inToken(s.amount, s.currency), 0);

  // The bank's own margin, which is the only fee it earns here.
  const spreadRial =
    imports.reduce((a, i) => a + (i.bankSpreadRial ?? 0), 0) +
    settlements.reduce((a, s) => a + (s.bankSpreadRial ?? 0), 0);

  const statusBreakdown = useMemo(
    () => outcomeSplit([...imports, ...settlements]),
    [imports, settlements],
  );
  const currencyBreakdown = useMemo(
    () => currencySplit([...imports, ...settlements], currencyLabel),
    [imports, settlements],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارشات بانک"
        description="تحلیل عملکرد مالی و عملیاتی"
        actions={<ExportExcelButton datasets={["settlements", "transactions", "ledger"]} />}
      />

      <Tabs defaultValue="overall">
        <TabsList>
          <TabsTrigger value="overall">خلاصه کلی</TabsTrigger>
          <TabsTrigger value="send">واردات</TabsTrigger>
          <TabsTrigger value="settle">تسویه</TabsTrigger>
          <TabsTrigger value="crypto">جریان کریپتو</TabsTrigger>
          <TabsTrigger value="rial">جریان ریال</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="حجم واردات" value={`${toPersianDigits(formatAmount(Math.round(sendVolumeRial / 1_000_000)))} م.ت`} />
            <StatCard label="حجم تسویه" value={`${toPersianDigits(formatAmount(Math.round(settleVolumeRial / 1_000_000)))} م.ت`} />
            <StatCard label="تعداد واردات تسویه‌شده" value={toPersianDigits(imports.filter((i) => i.status === "PAID").length)} />
            <StatCard label="تعداد تسویه" value={toPersianDigits(settlements.filter((s) => s.status === "SETTLED").length)} />
            <StatCard label="تعداد کل عملیات" value={toPersianDigits(imports.length + settlements.length)} />
            <StatCard
              label="حاشیه ارزی بانک"
              value={`${toPersianDigits(formatAmount(Math.round(spreadRial / 1_000_000)))} م.ت`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>روند ماهانه عملیات (میلیون تومان)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthVolume}>
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
                    <Line type="monotone" dataKey="send" stroke="oklch(0.55 0.18 240)" strokeWidth={2} />
                    <Line type="monotone" dataKey="settle" stroke="oklch(0.65 0.18 155)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>توزیع وضعیت</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${toPersianDigits(e.value)}%`}
                      >
                        {statusBreakdown.map((s) => (
                          <Cell key={s.name} fill={STATUS_COLORS[s.index]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                        formatter={((v: unknown, name: unknown) => [toPersianDigits(Number(v)) + "%", name]) as never}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>توزیع ارز</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currencyBreakdown}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${e.name} ${toPersianDigits(e.value)}%`}
                      >
                        {currencyBreakdown.map((c) => (
                          <Cell key={c.name} fill={CURRENCY_COLORS[c.index % CURRENCY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                        formatter={((v: unknown, name: unknown) => [toPersianDigits(Number(v)) + "%", name]) as never}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>تمام فاکتورهای واردات</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {toPersianDigits(imports.length)} فاکتور در سیستم. برای فیلتر و بررسی کامل به صفحه «واردات» مراجعه کنید.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settle" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>تمام درخواست‌های تسویه</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {toPersianDigits(settlements.length)} درخواست در سیستم. برای فیلتر و بررسی کامل به صفحه «تسویه» مراجعه کنید.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crypto" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="کل ارسالی از والت بانک"
              value={<MoneyText amount={cryptoSent} currency="USDT" />}
              hint="واردات"
            />
            <StatCard
              label="کل دریافتی به والت بانک"
              value={<MoneyText amount={cryptoReceived} currency="USDT" />}
              hint="تسویه"
            />
            <StatCard
              label="خالص ارز"
              value={<MoneyText amount={cryptoReceived - cryptoSent} currency="USDT" />}
              trend={cryptoReceived - cryptoSent >= 0 ? "up" : "down"}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>جریان ماهانه ارز</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cryptoMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(Math.round(v))} width={50} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                      formatter={((v: unknown, name: unknown) => [
                        toPersianDigits(Math.round(Number(v))),
                        name === "send" ? "ارسالی" : "دریافتی",
                      ]) as never}
                    />
                    <Bar dataKey="send" fill="oklch(0.55 0.18 240)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="receive" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rial" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="کل دریافتی از کاربران" value={`${toPersianDigits(formatAmount(Math.round(sendVolumeRial / 1_000_000)))} م.ت`} hint="واردات" />
            <StatCard label="کل پرداختی به کاربران" value={`${toPersianDigits(formatAmount(Math.round(settleVolumeRial / 1_000_000)))} م.ت`} hint="تسویه" />
            <StatCard label="خالص" value={`${toPersianDigits(formatAmount(Math.round((sendVolumeRial - settleVolumeRial) / 1_000_000)))} م.ت`} trend={sendVolumeRial >= settleVolumeRial ? "up" : "down"} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
