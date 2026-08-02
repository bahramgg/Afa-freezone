"use client";

import Link from "next/link";
import { Banknote, FileCheck2, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { AdminVolumeChart, UserGrowthChart } from "@/components/charts/AdminCharts";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useTxStore } from "@/lib/stores/transactions";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits } from "@/lib/format";
import { useAdminUsersStore } from "@/lib/stores/adminUsers";
import { useLoad } from "@/lib/stores/useLoad";

export default function AdminDashboardPage() {
  const invoices = useInvoicesStore((s) => s.list);
  const settlements = useSettlementsStore((s) => s.list);
  const txs = useTxStore((s) => s.list);
  const hydrated = useHydrated();

  const pendingInvoices = invoices.filter((i) => i.status === "PENDING").length;
  const pendingSettlements = settlements.filter((s) => s.status === "AWAITING_ADMIN").length;
  const users = useAdminUsersStore((s) => s.list);
  useLoad(useAdminUsersStore.getState().load);
  const pendingKyc = users.filter((u) => u.kyc === "PENDING").length;

  const monthVolume = txs.reduce((a, t) => a + t.amount * (t.currency === "BNB" ? 600 : 1), 0);
  const totalUsers = users.length;

  const recent = [
    ...invoices.slice(0, 2).map((i) => ({ type: "invoice" as const, label: "دریافت وجه جدید", user: i.userName, trx: i.trxId, amount: i.amount, currency: i.currency, createdAt: i.createdAt })),
    ...settlements.slice(0, 2).map((s) => ({ type: "settle" as const, label: "تسویه جدید", user: s.userName, trx: s.trxId, amount: s.amount, currency: s.currency, createdAt: s.createdAt })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="داشبورد ادمین" description="نمای کلی سیستم در لحظه" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="کاربران فعال"
          value={hydrated ? toPersianDigits(totalUsers) : "—"}
          icon={Users}
          delta="+۱۲ این ماه"
          trend="up"
        />
        <StatCard
          label="در انتظار تأیید"
          value={hydrated ? toPersianDigits(pendingInvoices + pendingSettlements) : "—"}
          icon={FileCheck2}
          hint="نیاز به بررسی"
        />
        <StatCard
          label="حجم تراکنش‌های ماه"
          value={<MoneyText amount={monthVolume} currency="USDT" />}
          icon={TrendingUp}
          delta="+۱۸٪"
          trend="up"
        />
        <StatCard
          label="KYC در انتظار"
          value={hydrated ? toPersianDigits(pendingKyc) : "—"}
          icon={ShieldAlert}
          hint="نیاز به بررسی"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QueueCard
          title="دریافت وجه در انتظار"
          count={pendingInvoices}
          href="/admin/invoices"
          icon={<FileCheck2 className="h-4 w-4" />}
        />
        <QueueCard
          title="تسویه در انتظار"
          count={pendingSettlements}
          href="/admin/settlements"
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>رشد کاربران</CardTitle></CardHeader>
          <CardContent><UserGrowthChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>حجم تراکنش‌ها</CardTitle></CardHeader>
          <CardContent><AdminVolumeChart /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>آخرین فعالیت‌های سیستم</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-start font-medium py-2">زمان</th>
                  <th className="text-start font-medium py-2">رویداد</th>
                  <th className="text-start font-medium py-2">کاربر</th>
                  <th className="text-start font-medium py-2">TRX</th>
                  <th className="text-start font-medium py-2">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 text-muted-foreground"><JalaliDate iso={r.createdAt} relative /></td>
                    <td className="py-2.5">{r.label}</td>
                    <td className="py-2.5">{r.user ?? "—"}</td>
                    <td className="py-2.5 font-mono text-xs">{r.trx}</td>
                    <td className="py-2.5"><MoneyText amount={r.amount} currency={r.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueCard({ title, count, href, icon }: { title: string; count: number; href: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <span className="text-3xl font-bold text-primary">{toPersianDigits(count)}</span>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full" variant="outline">
          <Link href={href}>مشاهده</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
