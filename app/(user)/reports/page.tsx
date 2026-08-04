"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { StatCard } from "@/components/shared/StatCard";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { InvoiceStatusBadge, SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { TransactionDetailModal } from "@/components/shared/TransactionDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExportExcelButton } from "@/components/shared/ExportExcelButton";
import { MonthlyVolumeChart } from "@/components/charts/MonthlyVolumeChart";
import { RatioPieChart } from "@/components/charts/RatioPieChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { useTxStore } from "@/lib/stores/transactions";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits, truncateHash } from "@/lib/format";
import { useInToken } from "@/lib/value";
import type { Transaction, Currency } from "@/lib/types";
import { nativeSymbol } from "@/lib/chains";

const PAGE = 8;

export default function ReportsPage() {
  const txs = useTxStore((s) => s.list);
  const settlements = useSettlementsStore((s) => s.list);
  const hydrated = useHydrated();

  const [tab, setTab] = useState("all");
  const [direction, setDirection] = useState<"all" | "RECEIVE" | "SEND">("all");
  const [currency, setCurrency] = useState<"all" | Currency>("all");
  const [status, setStatus] = useState<"all" | "CONFIRMED" | "PENDING" | "FAILED">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openTx, setOpenTx] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (tab === "received" && t.direction !== "RECEIVE") return false;
      if (tab === "sent" && t.direction !== "SEND") return false;
      if (direction !== "all" && t.direction !== direction) return false;
      if (currency !== "all" && t.currency !== currency) return false;
      if (status !== "all" && t.status !== status) return false;
      if (minAmount && t.amount < Number(minAmount)) return false;
      if (maxAmount && t.amount > Number(maxAmount)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !(t.invoiceId ?? "").toLowerCase().includes(q) &&
          !t.txHash.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [txs, tab, direction, currency, status, minAmount, maxAmount, query]);

  const inToken = useInToken();
  const totalReceived = filtered
    .filter((t) => t.direction === "RECEIVE")
    .reduce((a, t) => a + inToken(t.amount, t.currency), 0);
  const totalSent = filtered
    .filter((t) => t.direction === "SEND")
    .reduce((a, t) => a + inToken(t.amount, t.currency), 0);
  const avgAmount = filtered.length
    ? filtered.reduce((a, t) => a + t.amount, 0) / filtered.length
    : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);

  function clearFilters() {
    setDirection("all");
    setCurrency("all");
    setStatus("all");
    setMinAmount("");
    setMaxAmount("");
    setQuery("");
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارشات مالی"
        description="فیلتر، تحلیل و خروجی تمام فعالیت‌ها"
        actions={
          <ExportExcelButton datasets={["invoices", "settlements"]} />
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList className="w-full">
            <TabsTrigger value="all">همه تراکنش‌ها</TabsTrigger>
            <TabsTrigger value="received">دریافت‌ها</TabsTrigger>
            <TabsTrigger value="sent">پرداخت‌ها</TabsTrigger>
            <TabsTrigger value="settlements">درخواست‌های تسویه</TabsTrigger>
            <TabsTrigger value="monthly">خلاصه ماهانه</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={tab}>
          {tab === "settlements" ? (
            <SettlementsTab list={settlements} />
          ) : tab === "monthly" ? (
            <MonthlySummary />
          ) : (
            <div className="space-y-5">
              {/* Filters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="h-4 w-4" /> فیلترها
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">جستجو</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="INV-... یا 0x..." value={query} onChange={(e) => setQuery(e.target.value)} className="pe-8" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">نوع</Label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه</SelectItem>
                        <SelectItem value="RECEIVE">دریافت</SelectItem>
                        <SelectItem value="SEND">ارسال</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ارز</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BNB">{nativeSymbol()}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">وضعیت</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه</SelectItem>
                        <SelectItem value="CONFIRMED">تأیید شده</SelectItem>
                        <SelectItem value="PENDING">در انتظار</SelectItem>
                        <SelectItem value="FAILED">ناموفق</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">حداقل مبلغ</Label>
                    <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">حداکثر مبلغ</Label>
                    <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 flex items-end justify-end gap-2">
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4" />
                      حذف فیلترها
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="مجموع دریافتی" value={<MoneyText amount={totalReceived} currency="USDT" />} icon={ArrowDownLeft} />
                <StatCard label="مجموع پرداختی" value={<MoneyText amount={totalSent} currency="USDT" />} icon={ArrowUpRight} />
                <StatCard label="تعداد تراکنش‌ها" value={hydrated ? toPersianDigits(filtered.length) : "—"} />
                <StatCard label="میانگین مبلغ" value={<MoneyText amount={avgAmount} currency="USDT" />} />
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle>حجم ماهانه</CardTitle></CardHeader>
                  <CardContent><MonthlyVolumeChart /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>نسبت‌ها</CardTitle></CardHeader>
                  <CardContent>
                    <RatioPieChart
                      data={[
                        { name: "دریافتی", value: Math.round(totalReceived) || 1, color: "oklch(0.65 0.18 155)" },
                        { name: "پرداختی", value: Math.round(totalSent) || 1, color: "oklch(0.42 0.22 275)" },
                      ]}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  {filtered.length === 0 ? (
                    <div className="p-8">
                      <EmptyState title="نتیجه‌ای یافت نشد" description="فیلترهای خود را بازنگری کنید" />
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full min-w-[46rem] text-sm">
                          <thead className="bg-muted/50">
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-start font-medium px-4 py-3">شماره</th>
                              <th className="text-start font-medium px-4 py-3">نوع</th>
                              <th className="text-start font-medium px-4 py-3">مبلغ</th>
                              <th className="text-start font-medium px-4 py-3">طرف مقابل</th>
                              <th className="text-start font-medium px-4 py-3">TX hash</th>
                              <th className="text-start font-medium px-4 py-3">وضعیت</th>
                              <th className="text-start font-medium px-4 py-3">تاریخ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paged.map((t) => (
                              <tr
                                key={t.id}
                                onClick={() => setOpenTx(t)}
                                className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 font-mono text-xs">{t.invoiceId ?? t.id}</td>
                                <td className="px-4 py-3">
                                  {t.direction === "RECEIVE" ? (
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
                                <td className="px-4 py-3"><MoneyText amount={t.amount} currency={t.currency} /></td>
                                <td className="px-4 py-3 text-muted-foreground">{t.counterpartyName ?? "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs">{truncateHash(t.txHash)}</td>
                                <td className="px-4 py-3">
                                  <InvoiceStatusBadge status={t.status === "CONFIRMED" ? "PAID" : t.status === "PENDING" ? "PENDING" : "REJECTED"} />
                                </td>
                                <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={t.createdAt} withTime /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between border-t border-border p-3">
                        <span className="text-xs text-muted-foreground">
                          صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TransactionDetailModal tx={openTx} open={!!openTx} onOpenChange={(o) => !o && setOpenTx(null)} />
    </div>
  );
}

function SettlementsTab({ list }: { list: ReturnType<typeof useSettlementsStore.getState>["list"] }) {
  return (
    <Card>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="p-8"><EmptyState title="درخواست تسویه‌ای ثبت نشده" /></div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">شماره</th>
                  <th className="text-start font-medium px-4 py-3">مشخصات</th>
                  <th className="text-start font-medium px-4 py-3">مبلغ</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ ارسال</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ تسویه</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{s.goodsTitle}</td>
                    <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                    <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                    <td className="px-4 py-3"><SettlementStatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.settledAt ? <JalaliDate iso={s.settledAt} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlySummary() {
  const months = [
    { label: "آذر ۱۴۰۴", received: 4200, sent: 1800, count: 18, daily: [10, 12, 8, 14, 18, 22, 19, 25, 21, 17, 13, 16] },
    { label: "دی ۱۴۰۴", received: 5100, sent: 2400, count: 24, daily: [14, 11, 18, 22, 26, 30, 27, 24, 28, 22, 18, 21] },
    { label: "بهمن ۱۴۰۴", received: 6300, sent: 2800, count: 31, daily: [22, 24, 28, 30, 26, 29, 35, 33, 31, 27, 24, 28] },
    { label: "اسفند ۱۴۰۴", received: 7200, sent: 3500, count: 34, daily: [25, 30, 28, 32, 36, 38, 34, 30, 28, 26, 24, 30] },
    { label: "فروردین ۱۴۰۵", received: 5900, sent: 2900, count: 21, daily: [18, 20, 22, 24, 26, 30, 28, 24, 22, 20, 18, 22] },
    { label: "اردیبهشت ۱۴۰۵", received: 8100, sent: 3700, count: 38, daily: [28, 32, 30, 35, 40, 42, 38, 36, 34, 30, 32, 38] },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((m) => {
        const net = m.received - m.sent;
        return (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{m.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">دریافتی</div>
                  <div className="text-success font-medium">
                    <MoneyText amount={m.received} currency="USDT" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">پرداختی</div>
                  <div className="text-primary font-medium">
                    <MoneyText amount={m.sent} currency="USDT" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">تراکنش‌ها</div>
                  <div className="font-medium">{toPersianDigits(m.count)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">مانده خالص</div>
                  <div className={net >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                    <MoneyText amount={net} currency="USDT" sign={net >= 0 ? "+" : "-"} />
                  </div>
                </div>
              </div>
              <Sparkline data={m.daily} color="oklch(0.42 0.22 275)" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
