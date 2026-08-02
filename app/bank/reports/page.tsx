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
import { bankVolumeSeries } from "@/lib/mock/fixtures";
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

  const monthVolume = useMemo(() => bankVolumeSeries(6), []);

  // The rial the bank took from importers, against currency it supplied.
  const sendVolumeRial = imports
    .filter((i) => i.status === "PAID")
    .reduce((a, i) => a + (i.rialAmount ?? 0), 0);
  const settleVolumeRial = settlements
    .filter((s) => s.status === "SETTLED")
    .reduce((a, s) => a + (s.rialAmount ?? 0), 0);
  const cryptoSent = imports
    .filter((i) => i.status === "PAID" || i.status === "PAYMENT_PENDING")
    .reduce((a, i) => a + (i.amount + (i.fee ?? 0)) * (i.currency === "BNB" ? 280 : 1), 0);
  const cryptoReceived = settlements.filter((s) => s.status === "SETTLED" || s.status === "CRYPTO_CONFIRMED").reduce((a, s) => a + s.amount * (s.currency === "BNB" ? 280 : 1), 0);

  const statusBreakdown = [
    { name: "موفق", value: 76 },
    { name: "در انتظار", value: 14 },
    { name: "رد شده", value: 10 },
  ];
  const currencyBreakdown = [
    { name: "USDT", value: 84 },
    { name: "BNB", value: 16 },
  ];

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
            <StatCard label="حجم واردات ماه (ریال)" value={`${toPersianDigits(formatAmount(Math.round(sendVolumeRial / 1_000_000)))} م.ت`} />
            <StatCard label="حجم تسویه ماه (ریال)" value={`${toPersianDigits(formatAmount(Math.round(settleVolumeRial / 1_000_000)))} م.ت`} />
            <StatCard label="تعداد واردات تسویه‌شده" value={toPersianDigits(imports.filter((i) => i.status === "PAID").length)} />
            <StatCard label="تعداد تسویه" value={toPersianDigits(settlements.filter((s) => s.status === "SETTLED").length)} />
            <StatCard label="میانگین زمان پاسخ" value="۱.۸ ساعت" />
            <StatCard label="درآمد کارمزد ماه" value="۱۴.۲ م.ت" />
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
                        {statusBreakdown.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i]} />)}
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
                        {currencyBreakdown.map((_, i) => <Cell key={i} fill={CURRENCY_COLORS[i]} />)}
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
              label="موجودی خالص ماه"
              value={<MoneyText amount={cryptoReceived - cryptoSent} currency="USDT" />}
              trend={cryptoReceived - cryptoSent >= 0 ? "up" : "down"}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>جریان روزانه</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthVolume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }} />
                    <Bar dataKey="send" fill="oklch(0.55 0.18 240)" radius={[4, 4, 0, 0]} />
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
            <StatCard label="خالص ماه" value={`${toPersianDigits(formatAmount(Math.round((sendVolumeRial - settleVolumeRial) / 1_000_000)))} م.ت`} trend={sendVolumeRial >= settleVolumeRial ? "up" : "down"} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
