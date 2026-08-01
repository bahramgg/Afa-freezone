"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Invoice } from "@/lib/types";

export function InvoiceTable({ list }: { list: Invoice[] }) {
  if (!list.length) {
    return (
      <EmptyState
        title="فاکتوری یافت نشد"
        description="در این وضعیت هیچ فاکتوری وجود ندارد"
      />
    );
  }
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="text-start font-medium px-4 py-3">شماره فاکتور</th>
              <th className="text-start font-medium px-4 py-3">تاریخ</th>
              <th className="text-start font-medium px-4 py-3">مبلغ</th>
              <th className="text-start font-medium px-4 py-3">طرف مقابل</th>
              <th className="text-start font-medium px-4 py-3">وضعیت</th>
              <th className="text-start font-medium px-4 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr
                key={inv.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <JalaliDate iso={inv.createdAt} />
                </td>
                <td className="px-4 py-3">
                  <MoneyText amount={inv.amount} currency={inv.currency} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.counterpartyName ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3">
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href={`/receive/${inv.id}`}>
                      جزئیات
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
