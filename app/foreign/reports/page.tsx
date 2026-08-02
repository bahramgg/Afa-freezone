"use client";

import { useCallback, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportExcelButton } from "@/components/shared/ExportExcelButton";
import { Ltr } from "@/components/shared/Ltr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import type { Invoice } from "@/lib/types";
import { useForeignStore } from "@/lib/stores/foreign";
import { truncateAddress, truncateHash, bscScanUrl, toPersianDigits } from "@/lib/format";

const MONTH_DATA = [
  { month: "شهریور", received: 180 },
  { month: "مهر", received: 320 },
  { month: "آبان", received: 250 },
  { month: "آذر", received: 480 },
  { month: "دی", received: 150 },
  { month: "بهمن", received: 470 },
];

export default function ForeignReportsPage() {
  const user = useForeignStore((s) => s.user);
  const [list, setList] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Invoice[] }>("/invoices?status=ALL");
    setList(data.list);
  }, []);
  useLoad(load);

  // Both sides of this account: exports it was asked to pay, and its own sales.
  const my = list;

  const [tab, setTab] = useState<"all" | "success" | "in-progress" | "rejected">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return my.filter((s) => {
      if (tab === "success") if (s.status !== "PAID") return false;
      if (tab === "rejected") if (s.status !== "REJECTED") return false;
      if (tab === "in-progress")
        if (!["PENDING", "APPROVED", "PAYMENT_PENDING", "BANK_RATE_LOCKED", "RIAL_RECEIVED"].includes(s.status)) return false;
      if (search && !`${s.trxId} ${s.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [my, tab, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارشات"
        description="تاریخچه کامل فاکتورهای شما"
        actions={<ExportExcelButton datasets={["invoices"]} />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>روند ۶ ماه گذشته</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MONTH_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={40} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontFamily: "var(--font-vazirmatn)", direction: "rtl" }}
                    formatter={((v: unknown) => [toPersianDigits(Number(v)) + " USDT", "دریافتی"]) as never}
                  />
                  <Line type="monotone" dataKey="received" stroke="oklch(0.42 0.22 275)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>فیلتر و جستجو</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>جستجو در TRX</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="TRX-..." />
              <p className="text-xs text-muted-foreground">
                {toPersianDigits(filtered.length)} نتیجه از {toPersianDigits(my.length)} رکورد
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">همه دریافت‌ها</TabsTrigger>
          <TabsTrigger value="success">موفق</TabsTrigger>
          <TabsTrigger value="in-progress">در جریان</TabsTrigger>
          <TabsTrigger value="rejected">رد شده</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-start font-medium px-4 py-3">TRX</th>
                      <th className="text-start font-medium px-4 py-3">فرستنده</th>
                      <th className="text-start font-medium px-4 py-3">مبلغ</th>
                      <th className="text-start font-medium px-4 py-3">کیف پول دریافت</th>
                      <th className="text-start font-medium px-4 py-3">TX</th>
                      <th className="text-start font-medium px-4 py-3">وضعیت</th>
                      <th className="text-start font-medium px-4 py-3">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">رکوردی یافت نشد</td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3">{(s.userUid === user?.uid ? s.counterpartyName : s.userName) ?? "—"}</td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            <Ltr>{s.beneficiaryWallet ? truncateAddress(s.beneficiaryWallet) : "—"}</Ltr>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {s.txHash ? (
                              <a href={bscScanUrl(s.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                                {truncateHash(s.txHash)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3"><InvoiceStatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
