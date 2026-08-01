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
import { useSendStore } from "@/lib/stores/send";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { adminVolumeSeries } from "@/lib/mock/fixtures";
import { useAdminUsersStore } from "@/lib/stores/adminUsers";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits } from "@/lib/format";

const STATUS_COLORS = ["oklch(0.55 0.2 145)", "oklch(0.75 0.18 80)", "oklch(0.55 0.22 25)"];
const CURRENCY_COLORS = ["oklch(0.55 0.18 240)", "oklch(0.75 0.18 80)"];

export default function AdminReportsPage() {
  const invoices = useInvoicesStore((s) => s.list);
  const sends = useSendStore((s) => s.list);
  const settlements = useSettlementsStore((s) => s.list);

  const monthly = useMemo(() => adminVolumeSeries(6), []);
  const monthlyWithSettle = monthly.map((m, i) => ({
    ...m,
    settle: [380, 520, 440, 620, 680, 790][i] ?? 0,
  }));

  const users = useAdminUsersStore((s) => s.list);
  useLoad(useAdminUsersStore.getState().load);
  const iranian = users.filter((u) => u.type === "IRANIAN").length;
  const foreign = users.filter((u) => u.type === "FOREIGN").length;
  const pendingKyc = users.filter((u) => u.kyc === "PENDING").length;
  const rejectedKyc = users.filter((u) => u.kyc === "REJECTED").length;

  const totalVolume = invoices.reduce((a, i) => a + i.amount * (i.currency === "BNB" ? 600 : 1), 0)
    + sends.reduce((a, s) => a + s.amount * (s.currency === "BNB" ? 600 : 1), 0)
    + settlements.reduce((a, s) => a + s.amount * (s.currency === "BNB" ? 600 : 1), 0);
  const totalReceive = invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amount * (i.currency === "BNB" ? 600 : 1), 0);
  const totalSend = sends.filter((s) => s.status === "PAID").reduce((a, s) => a + s.amount * (s.currency === "BNB" ? 600 : 1), 0);
  const settled = settlements.filter((s) => s.status === "SETTLED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارشات سیستم"
        description="تحلیل عملکرد ادمین و کلیت سیستم"
        actions={
          <ExportExcelButton
            datasets={["invoices", "sends", "settlements", "transactions", "ledger", "users"]}
          />
        }
      />

      <Tabs defaultValue="overall">
        <TabsList>
          <TabsTrigger value="overall">خلاصه کلی</TabsTrigger>
          <TabsTrigger value="receive">دریافت وجه</TabsTrigger>
          <TabsTrigger value="send">ارسال وجه</TabsTrigger>
          <TabsTrigger value="settle">تسویه</TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="کل حجم تراکنش‌ها" value={<MoneyText amount={totalVolume} currency="USDT" />} />
            <StatCard label="کل دریافت وجه" value={<MoneyText amount={totalReceive} currency="USDT" />} />
            <StatCard label="کل ارسال وجه" value={<MoneyText amount={totalSend} currency="USDT" />} />
            <StatCard label="درآمد کارمزد" value={<MoneyText amount={totalVolume * 0.02} currency="USDT" />} />
            <StatCard label="تعداد کل تراکنش‌ها" value={toPersianDigits(invoices.length + sends.length + settlements.length)} />
            <StatCard label="میانگین مبلغ" value={<MoneyText amount={328} currency="USDT" />} />
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
                        data={[{ name: "موفق", value: 76 }, { name: "در انتظار", value: 14 }, { name: "رد شده", value: 10 }]}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${toPersianDigits(e.value)}%`}
                      >
                        <Cell fill={STATUS_COLORS[0]} />
                        <Cell fill={STATUS_COLORS[1]} />
                        <Cell fill={STATUS_COLORS[2]} />
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
                        data={[{ name: "USDT", value: 82 }, { name: "BNB", value: 18 }]}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${e.name} ${toPersianDigits(e.value)}%`}
                      >
                        <Cell fill={CURRENCY_COLORS[0]} />
                        <Cell fill={CURRENCY_COLORS[1]} />
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
            <CardHeader><CardTitle>{toPersianDigits(sends.length)} درخواست ارسال</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start py-2">TRX</th>
                    <th className="text-start py-2">کاربر</th>
                    <th className="text-start py-2">گیرنده</th>
                    <th className="text-start py-2">مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.slice(0, 12).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-mono text-xs">{s.trxId}</td>
                      <td className="py-2.5">{s.userName ?? "—"}</td>
                      <td className="py-2.5">{s.counterpartyName ?? s.counterpartyUid}</td>
                      <td className="py-2.5"><MoneyText amount={s.amount} currency={s.currency} /></td>
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
