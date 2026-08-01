"use client";

import Link from "next/link";
import { ArrowDownLeft, ChevronLeft, Inbox, Wallet, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { useSendStore } from "@/lib/stores/send";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits } from "@/lib/format";

export default function ForeignDashboardPage() {
  const sends = useSendStore((s) => s.list);
  const user = useForeignStore((s) => s.user);
  const wallets = useForeignStore((s) => s.wallets);
  const hydrated = useHydrated();

  const myRequests = sends.filter((s) => s.counterpartyUid === user?.uid);
  const totalReceived = myRequests
    .filter((s) => s.status === "PAID")
    .reduce((acc, s) => acc + s.amount * (s.currency === "BNB" ? 600 : 1), 0);
  const active = myRequests.filter((s) => s.status !== "PAID" && s.status !== "REJECTED").length;
  const monthCount = myRequests.length;
  const pendingApproval = myRequests.filter((s) => s.status === "AWAITING_COUNTERPARTY").length;

  const recent = myRequests.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="داشبورد" description={`Welcome, ${user?.fullName ?? "Partner"}`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="مجموع دریافتی"
          value={<MoneyText amount={totalReceived} currency="USDT" />}
          delta="+۸٪"
          trend="up"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="درخواست‌های فعال"
          value={hydrated ? toPersianDigits(active) : "—"}
          icon={Inbox}
        />
        <StatCard
          label="تراکنش‌های این ماه"
          value={hydrated ? toPersianDigits(monthCount) : "—"}
          delta="+۲٪"
          trend="up"
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>آخرین درخواست‌ها</CardTitle>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/foreign/requests" className="gap-1">
                مشاهده همه
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-start font-medium py-2">TRX</th>
                    <th className="text-start font-medium py-2">فرستنده</th>
                    <th className="text-start font-medium py-2">مبلغ</th>
                    <th className="text-start font-medium py-2">وضعیت</th>
                    <th className="text-start font-medium py-2">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                        درخواستی برای نمایش وجود ندارد
                      </td>
                    </tr>
                  ) : (
                    recent.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 font-mono text-xs">{s.trxId}</td>
                        <td className="py-2.5">{s.userName ?? s.userUid ?? "—"}</td>
                        <td className="py-2.5"><MoneyText amount={s.amount} currency={s.currency} /></td>
                        <td className="py-2.5"><SendStatusBadge status={s.status} /></td>
                        <td className="py-2.5 text-muted-foreground">
                          <JalaliDate iso={s.createdAt} relative />
                        </td>
                      </tr>
                    ))
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
                <Link href="/foreign/requests">
                  در انتظار تأیید: {hydrated ? toPersianDigits(pendingApproval) : "—"}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/foreign/wallets">مدیریت والت‌ها</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
