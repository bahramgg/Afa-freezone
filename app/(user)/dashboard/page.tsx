"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, FileText, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { TransactionStatusBadge } from "@/components/shared/StatusBadge";
import { TransactionDetailModal } from "@/components/shared/TransactionDetailModal";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useTxStore } from "@/lib/stores/transactions";
import { useAuthStore } from "@/lib/stores/auth";
import { useWalletsStore } from "@/lib/stores/wallets";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits, truncateHash } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function DashboardPage() {
  const invoices = useInvoicesStore((s) => s.list);
  const transactions = useTxStore((s) => s.list);
  const user = useAuthStore((s) => s.user);
  const wallets = useWalletsStore((s) => s.list);
  const hydrated = useHydrated();

  const [openTx, setOpenTx] = useState<Transaction | null>(null);

  const totalReceived = transactions
    .filter((t) => t.direction === "RECEIVE" && t.status === "CONFIRMED")
    .reduce((acc, t) => acc + t.amount * (t.currency === "BNB" ? 600 : 1), 0);
  const totalSent = transactions
    .filter((t) => t.direction === "SEND" && t.status === "CONFIRMED")
    .reduce((acc, t) => acc + t.amount * (t.currency === "BNB" ? 600 : 1), 0);
  const activeInvoices = invoices.filter(
    (i) => i.status === "PENDING" || i.status === "APPROVED" || i.status === "PAYMENT_PENDING",
  ).length;
  const txThisMonth = transactions.length;

  const recent = transactions.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد"
        description="نمای کلی فعالیت‌های مالی شما"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="مجموع دریافتی"
          value={<MoneyText amount={totalReceived} currency="USDT" />}
          delta="+۱۲٪"
          trend="up"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="مجموع پرداختی"
          value={<MoneyText amount={totalSent} currency="USDT" />}
          delta="-۵٪"
          trend="down"
          icon={ArrowUpRight}
        />
        <StatCard
          label="فاکتورهای فعال"
          value={hydrated ? toPersianDigits(activeInvoices) : "—"}
          delta="بدون تغییر"
          trend="flat"
          icon={FileText}
        />
        <StatCard
          label="تراکنش‌های این ماه"
          value={hydrated ? toPersianDigits(txThisMonth) : "—"}
          delta="+۱۸٪"
          trend="up"
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>فعالیت ۳۰ روز اخیر</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>وضعیت کلی</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">شناسه کاربری</span>
              <span className="font-mono text-sm">{user?.uid ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">وضعیت KYC</span>
              <Badge tone="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                تأیید شده
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">والت‌های متصل</span>
              <span className="text-sm font-medium">
                {hydrated ? toPersianDigits(wallets.length) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">عضویت از</span>
              <span className="text-sm">
                {hydrated && user ? <JalaliDate iso={user.joinedAt} /> : "—"}
              </span>
            </div>
            {/* mt-auto pins the action to the bottom when the card is stretched
                to match the taller chart beside it. */}
            <div className="mt-auto border-t border-border pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings">مدیریت تنظیمات</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>آخرین تراکنش‌ها</CardTitle>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/reports" className="gap-1">
                مشاهده همه
                <ChevronLeft className="h-4 w-4" />
              </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="text-start font-medium py-2">شماره</th>
                  <th className="text-start font-medium py-2">نوع</th>
                  <th className="text-start font-medium py-2">مبلغ</th>
                  <th className="text-start font-medium py-2">وضعیت</th>
                  <th className="text-start font-medium py-2">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setOpenTx(tx)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-mono text-xs">
                      {/* Isolate the identifier's direction without changing how
                          the cell itself aligns inside the RTL table. */}
                      <span dir="ltr" className="inline-block">
                        {tx.trxId ?? tx.invoiceId ?? truncateHash(tx.txHash)}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {tx.direction === "RECEIVE" ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          دریافت
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          ارسال
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <MoneyText amount={tx.amount} currency={tx.currency} />
                    </td>
                    <td className="py-2.5">
                      <TransactionStatusBadge status={tx.status} />
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      <JalaliDate iso={tx.createdAt} relative />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TransactionDetailModal
        tx={openTx}
        open={!!openTx}
        onOpenChange={(o) => !o && setOpenTx(null)}
      />
    </div>
  );
}
