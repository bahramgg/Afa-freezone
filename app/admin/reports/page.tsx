"use client";

import { useMemo } from "react";
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
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { currencySplit, monthlyTotals, outcomeSplit } from "@/lib/series";
import { currencyLabel } from "@/lib/chains";
import { useAdminUsersStore } from "@/lib/stores/adminUsers";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits } from "@/lib/format";
import { useInToken } from "@/lib/value";

const STATUS_COLORS = ["oklch(0.55 0.2 145)", "oklch(0.75 0.18 80)", "oklch(0.55 0.22 25)"];
const CURRENCY_COLORS = ["oklch(0.55 0.18 240)", "oklch(0.75 0.18 80)"];

export default function AdminReportsPage() {
  const invoices = useInvoicesStore((s) => s.list);
  const settlements = useSettlementsStore((s) => s.list);

  /**
   * Counted from the invoices and settlements this page already loads.
   * Everything here used to come from a fixtures file — fixed months, invented
   * volumes — on a page an official reads as a report.
   */
  const monthlyWithSettle = useMemo(
    () =>
      monthlyTotals(
        [...invoices, ...settlements] as ({ createdAt?: string } & Record<string, unknown>)[],
        {
          received: (r) =>
            "tradeDirection" in r && r.tradeDirection !== "IMPORT" ? Number(r.amount) : 0,
          sent: (r) => ("tradeDirection" in r && r.tradeDirection === "IMPORT" ? Number(r.amount) : 0),
          settle: (r) => (!("tradeDirection" in r) ? Number(r.amount) : 0),
        },
        6,
      ).map((m) => ({ ...m, volume: m.received + m.sent })),
    [invoices, settlements],
  );

  const byCurrency = useMemo(
    () => currencySplit([...invoices, ...settlements], currencyLabel),
    [invoices, settlements],
  );

  const byOutcome = useMemo(
    () => outcomeSplit([...invoices, ...settlements]),
    [invoices, settlements],
  );

  const users = useAdminUsersStore((s) => s.list);
  useLoad(useAdminUsersStore.getState().load);
  const iranian = users.filter((u) => u.type === "IRANIAN").length;
  const foreign = users.filter((u) => u.type === "FOREIGN").length;
  const pendingKyc = users.filter((u) => u.kyc === "PENDING").length;
  const rejectedKyc = users.filter((u) => u.kyc === "REJECTED").length;

  const inToken = useInToken();
  const totalVolume = invoices.reduce((a, i) => a + inToken(i.amount, i.currency), 0)
    + settlements.reduce((a, s) => a + inToken(s.amount, s.currency), 0);
  const totalReceive = invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + inToken(i.amount, i.currency), 0);
  const importInvoices = invoices.filter((i) => i.tradeDirection === "IMPORT");
  const totalImport = importInvoices
    .filter((i) => i.status === "PAID")
    .reduce((a, i) => a + inToken(i.amount, i.currency), 0);
  const settled = settlements.filter((s) => s.status === "SETTLED");

  // The gateway's fee, as it was charged on each record — not a rate applied
  // to the total, which would report a fee nobody was billed.
  const totalFee =
    invoices.reduce((a, i) => a + inToken(i.fee ?? 0, i.currency), 0) +
    settlements.reduce((a, s) => a + inToken(s.feeAmount ?? 0, s.currency), 0);
  const count = invoices.length + settlements.length;
  const avgAmount = count ? totalVolume / count : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارشات سیستم"
        description="تحلیل عملکرد ادمین و کلیت سیستم"
        actions={
          <ExportExcelButton
            datasets={["invoices", "settlements", "transactions", "ledger", "users"]}
          />
        }
      />

      <Tabs defaultValue="overall">
        <TabsList>
          <TabsTrigger value="overall">خلاصه کلی</TabsTrigger>
          <TabsTrigger value="receive">دریافت وجه</TabsTrigger>
          <TabsTrigger value="send">واردات</TabsTrigger>
          <TabsTrigger value="settle">تسویه</TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="کل حجم تراکنش‌ها" value={<MoneyText amount={totalVolume} currency="USDT" />} />
            <StatCard label="کل دریافت وجه" value={<MoneyText amount={totalReceive} currency="USDT" />} />
            <StatCard label="کل واردات" value={<MoneyText amount={totalImport} currency="USDT" />} />
            <StatCard label="درآمد کارمزد" value={<MoneyText amount={totalFee} currency="USDT" />} />
            <StatCard label="تعداد کل تراکنش‌ها" value={toPersianDigits(invoices.length + settlements.length)} />
            <StatCard label="میانگین مبلغ" value={<MoneyText amount={avgAmount} currency="USDT" />} />
          </div>

          <Card>
            <CardHeader><CardTitle>روند ماهانه</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyWithSettle}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }} />
                    <Line type="monotone" dataKey="received" stroke="oklch(0.55 0.2 145)" strokeWidth={2} />
                    <Line type="monotone" dataKey="sent" stroke="oklch(0.55 0.18 240)" strokeWidth={2} />
                    <Line type="monotone" dataKey="settle" stroke="oklch(0.75 0.18 80)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>توزیع وضعیت عملیات</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byOutcome}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${toPersianDigits(e.value)}%`}
                      >
                        {byOutcome.map((slice) => (
                          <Cell key={slice.name} fill={STATUS_COLORS[slice.index]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>توزیع ارز</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCurrency}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${e.name} ${toPersianDigits(e.value)}%`}
                      >
                        {byCurrency.map((slice) => (
                          <Cell
                            key={slice.name}
                            fill={CURRENCY_COLORS[slice.index % CURRENCY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receive" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{toPersianDigits(invoices.length)} فاکتور دریافت</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start py-2">TRX</th>
                    <th className="text-start py-2">کاربر</th>
                    <th className="text-start py-2">مبلغ</th>
                    <th className="text-start py-2">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 12).map((i) => (
                    <tr key={i.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-mono text-xs">{i.trxId}</td>
                      <td className="py-2.5">{i.userName ?? "—"}</td>
                      <td className="py-2.5"><MoneyText amount={i.amount} currency={i.currency} /></td>
                      <td className="py-2.5">{i.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{toPersianDigits(importInvoices.length)} فاکتور واردات</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start py-2">شماره</th>
                    <th className="text-start py-2">فروشنده</th>
                    <th className="text-start py-2">واردکننده</th>
                    <th className="text-start py-2">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {importInvoices.slice(0, 12).map((i) => (
                    <tr key={i.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-mono text-xs">{i.id}</td>
                      <td className="py-2.5">{i.userName ?? "—"}</td>
                      <td className="py-2.5">{i.counterpartyName ?? i.counterpartyUid}</td>
                      <td className="py-2.5"><MoneyText amount={i.amount} currency={i.currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settle" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {toPersianDigits(settlements.length)} تسویه — موفق: {toPersianDigits(settled.length)} — مجموع تسویه شده:{" "}
                <MoneyText amount={settled.reduce((a, s) => a + s.amount, 0)} currency="USDT" />
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start py-2">TRX</th>
                    <th className="text-start py-2">SET</th>
                    <th className="text-start py-2">کاربر</th>
                    <th className="text-start py-2">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.slice(0, 12).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-mono text-xs">{s.trxId}</td>
                      <td className="py-2.5 font-mono text-xs">{s.id}</td>
                      <td className="py-2.5">{s.userName ?? "—"}</td>
                      <td className="py-2.5"><MoneyText amount={s.amount} currency={s.currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="ایرانی فعال" value={toPersianDigits(iranian)} />
            <StatCard label="خارجی فعال" value={toPersianDigits(foreign)} />
            <StatCard label="در انتظار KYC" value={toPersianDigits(pendingKyc)} />
            <StatCard label="رد شده" value={toPersianDigits(rejectedKyc)} />
          </div>
          <Card>
            <CardHeader><CardTitle>فعال‌ترین کاربران</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start py-2">UID</th>
                    <th className="text-start py-2">نام</th>
                    <th className="text-start py-2">تراکنش‌ها</th>
                    <th className="text-start py-2">حجم</th>
                    <th className="text-start py-2">عضویت</th>
                  </tr>
                </thead>
                <tbody>
                  {[...users].sort((a, b) => b.volume - a.volume).slice(0, 8).map((u) => (
                    <tr key={u.uid} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-mono text-xs">{u.uid}</td>
                      <td className="py-2.5">{u.fullName}</td>
                      <td className="py-2.5">{toPersianDigits(u.invoiceCount)}</td>
                      <td className="py-2.5"><MoneyText amount={u.volume} currency="USDT" /></td>
                      <td className="py-2.5 text-muted-foreground"><JalaliDate iso={u.joinedAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
