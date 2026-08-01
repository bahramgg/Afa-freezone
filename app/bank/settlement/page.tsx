"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { BankSettlementReviewDialog } from "@/components/bank/BankSettlementReviewDialog";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits, formatAmount } from "@/lib/format";
import type { Settlement, SettlementStatus } from "@/lib/types";

const TABS: { value: SettlementStatus | "ALL"; label: string }[] = [
  { value: "AWAITING_BANK", label: "در انتظار بررسی" },
  { value: "BANK_RATE_LOCKED", label: "نرخ اعلام شد" },
  { value: "CRYPTO_RECEIVED", label: "TX دریافت شد" },
  { value: "CRYPTO_CONFIRMED", label: "در حال واریز ریال" },
  { value: "SETTLED", label: "موفق" },
  { value: "REJECTED", label: "رد شده" },
  { value: "ALL", label: "همه" },
];

const BANK_VISIBLE: SettlementStatus[] = [
  "AWAITING_BANK",
  "BANK_RATE_LOCKED",
  "CRYPTO_RECEIVED",
  "CRYPTO_CONFIRMED",
  "SETTLED",
  "REJECTED",
];

export default function BankSettlementPage() {
  const settlements = useSettlementsStore((s) => s.list);
  const hydrated = useHydrated();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("AWAITING_BANK");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Settlement | null>(null);

  const visible = settlements.filter((s) => BANK_VISIBLE.includes(s.status));

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    visible.forEach((s) => { c[s.status] = (c[s.status] ?? 0) + 1; });
    return c;
  }, [visible]);

  const filtered = useMemo(() => {
    return visible.filter((s) => {
      if (tab !== "ALL" && s.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.trxId.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.userName?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [visible, tab, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسویه"
        description="درخواست‌های تسویه ارجاع شده از ادمین"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو TRX/SET/نام..."
            className="w-56"
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          {TABS.map((t) => {
            const n = t.value !== "ALL" ? counts[t.value as SettlementStatus] : visible.length;
            return (
              <TabsTrigger key={t.value} value={t.value} className="text-xs whitespace-nowrap">
                {t.label}
                {n ? <span className="ms-1 rounded-full bg-primary/10 px-1.5 text-[10px]">{toPersianDigits(n)}</span> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-start font-medium px-4 py-3">TRX</th>
                      <th className="text-start font-medium px-4 py-3">SET</th>
                      <th className="text-start font-medium px-4 py-3">کاربر</th>
                      <th className="text-start font-medium px-4 py-3">مشخصات کالا</th>
                      <th className="text-start font-medium px-4 py-3">مبلغ</th>
                      <th className="text-start font-medium px-4 py-3">نرخ</th>
                      <th className="text-start font-medium px-4 py-3">معادل ریالی</th>
                      <th className="text-start font-medium px-4 py-3">وضعیت</th>
                      <th className="text-start font-medium px-4 py-3">تاریخ</th>
                      <th className="text-start font-medium px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hydrated || filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">رکوردی یافت نشد</td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                          <td className="px-4 py-3">{s.userName ?? "—"}</td>
                          <td className="px-4 py-3 truncate max-w-[180px]">{s.goodsTitle}</td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 text-xs">
                            {toPersianDigits(formatAmount(s.exchangeRate ?? 0))} ت
                            <div className="text-[10px] text-muted-foreground">{s.rateLocked ? "قطعی" : "تخمینی"}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">{toPersianDigits(formatAmount(s.rialAmount ?? 0))} ت</td>
                          <td className="px-4 py-3"><SettlementStatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                          <td className="px-4 py-3 text-end">
                            <Button size="sm" variant="outline" onClick={() => setOpen(s)}>بررسی</Button>
                          </td>
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

      <BankSettlementReviewDialog item={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
