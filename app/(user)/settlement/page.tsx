"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { SettlementForm } from "@/components/settlement/SettlementForm";
import { SettlementDetailDialog } from "@/components/settlement/SettlementDetailDialog";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useHydrated } from "@/lib/stores/hydration";
import { toPersianDigits, formatAmount } from "@/lib/format";
import type { Settlement } from "@/lib/types";

export default function SettlementPage() {
  const list = useSettlementsStore((s) => s.list);
  const hydrated = useHydrated();
  const [open, setOpen] = useState<Settlement | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسویه"
        description="درخواست تسویه کریپتو به ریال — بررسی ادمین + بانک"
        actions={<SettlementForm />}
      />

      <Card>
        <CardContent className="p-0">
          {!hydrated || list.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="درخواست تسویه‌ای وجود ندارد"
                description="با کلیک روی «درخواست جدید» اولین درخواست تسویه را ارسال کنید"
              />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">TRX</th>
                    <th className="text-start font-medium px-4 py-3">SET</th>
                    <th className="text-start font-medium px-4 py-3">مشخصات</th>
                    <th className="text-start font-medium px-4 py-3">مبلغ</th>
                    <th className="text-start font-medium px-4 py-3">نرخ</th>
                    <th className="text-start font-medium px-4 py-3">معادل ریالی</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ</th>
                    <th className="text-start font-medium px-4 py-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setOpen(s)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{s.goodsTitle}</td>
                      <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                      <td className="px-4 py-3 text-xs">
                        {toPersianDigits(formatAmount(s.exchangeRate ?? 0))} ت
                        <div className="text-[10px] text-muted-foreground">{s.rateLocked ? "قطعی" : "تخمینی"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{toPersianDigits(formatAmount(s.rialAmount ?? 0))} ت</td>
                      <td className="px-4 py-3"><SettlementStatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="gap-1">
                          مشاهده
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SettlementDetailDialog
        item={open}
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
      />
    </div>
  );
}
