"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { CreateInvoiceDialog } from "@/components/invoice/CreateInvoiceDialog";
import { InvoiceTable } from "@/components/invoice/InvoiceTable";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useHydrated } from "@/lib/stores/hydration";
import type { InvoiceStatus } from "@/lib/types";
import { toPersianDigits } from "@/lib/format";

type TabKey = "ALL" | "PENDING" | "APPROVED_OR_PENDING_PAYMENT" | "PAID" | "EXPIRED" | "REJECTED";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "همه" },
  { key: "PENDING", label: "در انتظار تأیید ادمین" },
  { key: "APPROVED_OR_PENDING_PAYMENT", label: "تأیید شده (در انتظار پرداخت)" },
  { key: "PAID", label: "پرداخت شده" },
  { key: "EXPIRED", label: "منقضی" },
  { key: "REJECTED", label: "رد شده" },
];

const STATUSES_FOR: Record<TabKey, InvoiceStatus[] | "ALL"> = {
  ALL: "ALL",
  PENDING: ["PENDING"],
  APPROVED_OR_PENDING_PAYMENT: ["APPROVED", "PAYMENT_PENDING"],
  PAID: ["PAID"],
  EXPIRED: ["EXPIRED"],
  REJECTED: ["REJECTED"],
};

export default function ReceivePage() {
  const all = useInvoicesStore((s) => s.list);
  const hydrated = useHydrated();
  const [tab, setTab] = useState<TabKey>("ALL");

  /**
   * Exports only.
   *
   * The store holds every invoice the merchant is party to, in both
   * directions, and this page took the lot. A merchant who also imports saw
   * their import invoices listed here under "صادرات — دریافت وجه", described
   * as money coming in when it is money going out. `/imports` had always
   * filtered; this side never did.
   */
  const list = useMemo(() => all.filter((i) => i.tradeDirection !== "IMPORT"), [all]);

  const filtered =
    tab === "ALL"
      ? list
      : list.filter((i) => (STATUSES_FOR[tab] as InvoiceStatus[]).includes(i.status));
  const counts = TABS.reduce<Record<TabKey, number>>((acc, t) => {
    const allowed = STATUSES_FOR[t.key];
    acc[t.key] = allowed === "ALL" ? list.length : list.filter((i) => allowed.includes(i.status)).length;
    return acc;
  }, {} as Record<TabKey, number>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="صادرات — دریافت وجه"
        description="درخواست پرداخت برای خریدار خارجی؛ پس از پرداخت، بانک معادل ریالی را به حساب شما می‌ریزد"
        actions={<CreateInvoiceDialog />}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList className="w-full">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                <span>{t.label}</span>
                {hydrated ? (
                  <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                    {toPersianDigits(counts[t.key] ?? 0)}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={tab}>
          <InvoiceTable list={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
