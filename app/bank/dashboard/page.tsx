"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Building2, Coins, Send, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { SendStatusBadge, SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { useSendStore } from "@/lib/stores/send";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useBankStore } from "@/lib/stores/bank";
import { useHydrated } from "@/lib/stores/hydration";
import { bankVolumeSeries, usdtRateSeries } from "@/lib/mock/fixtures";
import { toPersianDigits, formatAmount } from "@/lib/format";

export default function BankDashboardPage() {
  const sends = useSendStore((s) => s.list);
  const settlements = useSettlementsStore((s) => s.list);
  const wallets = useBankStore((s) => s.wallets);
  const hydrated = useHydrated();

  const pendingSend = sends.filter((s) => s.status === "AWAITING_BANK_REVIEW").length;
  const pendingSettlement = settlements.filter((s) => s.status === "AWAITING_BANK").length;

  const volumeData = useMemo(() => bankVolumeSeries(6), []);
  const rateData = useMemo(() => usdtRateSeries(30), []);

  const totalUsdt = wallets.reduce((a, w) => a + w.usdtBalance, 0);
  const totalBnb = wallets.reduce((a, w) => a + w.bnbBalance, 0);
  const monthRial = 820_000_000;

  const recentActivity = [
    ...sends
      .filter((s) => ["AWAITING_BANK_REVIEW", "BANK_RATE_LOCKED", "RIAL_RECEIVED", "CRYPTO_SENT", "PAID"].includes(s.status))
      .slice(0, 3)
      .map((s) => ({
        type: "send" as const,
        trx: s.trxId,
        user: s.userName,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        createdAt: s.createdAt,
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
          label="ارسال وجه در انتظار"
          value={hydrated ? toPersianDigits(pendingSend) : "—"}
          icon={Send}
          hint="نیاز به بررسی"
        />
        <StatCard
          label="تسویه در انتظار"
          value={hydrated ? toPersianDigits(pendingSettlement) : "—"}
          icon={Banknote}
          hint="نیاز به بررسی"
        />
        <StatCard
          label="حجم عملیات ماه"
          value={hydrated ? `${formatAmount(monthRial / 1_000_000)} میلیون ت` : "—"}
          delta="+۲۲٪"
          trend="up"
          icon={TrendingUp}
        />
        <StatCard
          label="موجودی USDT"
          value={<MoneyText amount={totalUsdt} currency="USDT" />}
          icon={Wallet}
          hint={hydrated ? `${toPersianDigits(totalBnb.toFixed(2))} BNB` : ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ارسال وجه در انتظار</CardTitle>
            <span className="text-2xl font-bold text-emerald-700">{hydrated ? toPersianDigits(pendingSend) : "—"}</span>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-emerald-700 hover:bg-emerald-600">
              <Link href="/bank/send">مشاهده صف</Link>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>حجم عملیات ۶ ماه گذشته</CardTitle>
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
                      name === "send" ? "ارسال وجه" : "تسویه",
                    ]) as never}
                  />
                  <Bar dataKey="send" fill="oklch(0.55 0.18 240)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="settle" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>نرخ USDT (۳۰ روز)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(Math.round(v / 1000)) + "k"} width={45} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                    formatter={((v: unknown) => [toPersianDigits(Number(v)) + " ت", "نرخ"]) as never}
                  />
                  <Line type="monotone" dataKey="rate" stroke="oklch(0.55 0.2 145)" strokeWidth={2} dot={false} />
                </LineChart>
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
            <table className="w-full text-sm">
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
                        <span className={`inline-flex items-center gap-1 ${a.type === "send" ? "text-info" : "text-success"}`}>
                          {a.type === "send" ? <Send className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
                          {a.type === "send" ? "ارسال وجه" : "تسویه"}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-xs">{a.trx}</td>
                      <td className="py-2.5">{a.user ?? "—"}</td>
                      <td className="py-2.5"><MoneyText amount={a.amount} currency={a.currency} /></td>
                      <td className="py-2.5">
                        {a.type === "send" ? (
                          <SendStatusBadge status={a.status as any} />
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
