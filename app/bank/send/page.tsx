"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { BankSendReviewDialog } from "@/components/bank/BankSendReviewDialog";
import { useSendStore } from "@/lib/stores/send";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits, formatAmount } from "@/lib/format";
import type { SendRequest, SendStatus } from "@/lib/types";

const TABS: { value: SendStatus | "ALL" | "ACTIVE"; label: string }[] = [
  { value: "AWAITING_BANK_REVIEW", label: "در انتظار بررسی" },
  { value: "BANK_RATE_LOCKED", label: "نرخ اعلام شد" },
  { value: "RIAL_RECEIVED", label: "منتظر ارسال کریپتو" },
  { value: "CRYPTO_SENT", label: "کریپتو ارسال شد" },
  { value: "PAID", label: "موفق" },
  { value: "REJECTED", label: "رد شده" },
  { value: "ALL", label: "همه" },
];

const BANK_VISIBLE_STATUSES: SendStatus[] = [
  "AWAITING_BANK_REVIEW",
  "BANK_RATE_LOCKED",
  "RIAL_RECEIVED",
  "CRYPTO_SENT",
  "PAID",
  "REJECTED",
];

export default function BankSendPage() {
  const sends = useSendStore((s) => s.list);
  const hydrated = useHydrated();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("AWAITING_BANK_REVIEW");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<SendRequest | null>(null);

  const visible = sends.filter((s) => BANK_VISIBLE_STATUSES.includes(s.status));

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    visible.forEach((s) => {
      c[s.status] = (c[s.status] ?? 0) + 1;
    });
    return c;
  }, [visible]);

  const filtered = useMemo(() => {
    return visible.filter((s) => {
      if (tab !== "ALL" && tab !== "ACTIVE" && s.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.trxId.toLowerCase().includes(q) && !s.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [visible, tab, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ارسال وجه (بازنشسته)"
        description="درخواست‌های باقی‌مانده از مسیر قدیمی واردات — تا پایان کار پیگیری می‌شوند"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو TRX یا نام..."
            className="w-56"
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          {TABS.map((t) => {
            const n = t.value !== "ALL" ? counts[t.value as SendStatus] : visible.length;
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
                      <th className="text-start font-medium px-4 py-3">کاربر ایرانی</th>
                      <th className="text-start font-medium px-4 py-3">کاربر خارجی</th>
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
                        <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">رکوردی یافت نشد</td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3">{s.userName ?? "—"}</td>
                          <td className="px-4 py-3">
                            {s.counterpartyName ?? "—"}
                            <div className="text-xs text-muted-foreground font-mono">{s.counterpartyUid}</div>
                          </td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 text-xs">
                            {toPersianDigits(formatAmount(s.exchangeRate ?? 0))} ت
                            <div className="text-[10px] text-muted-foreground">{s.rateLocked ? "قطعی" : "تخمینی"}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">{toPersianDigits(formatAmount(s.rialAmount ?? 0))} ت</td>
                          <td className="px-4 py-3"><SendStatusBadge status={s.status} /></td>
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

      <BankSendReviewDialog item={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
