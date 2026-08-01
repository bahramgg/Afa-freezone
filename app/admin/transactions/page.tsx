"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { useTxStore } from "@/lib/stores/transactions";
import { useHydrated } from "@/lib/stores/hydration";
import { bscScanUrl, truncateAddress, truncateHash } from "@/lib/format";

type Filter = "ALL" | "CONFIRMED" | "PENDING" | "FAILED" | "UNMATCHED";

const LABELS: Record<Filter, string> = {
  ALL: "همه",
  CONFIRMED: "تأیید شده",
  PENDING: "در انتظار",
  FAILED: "ناموفق",
  UNMATCHED: "بدون تطبیق",
};

export default function AdminTransactionsPage() {
  const list = useTxStore((s) => s.list);
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.txHash.toLowerCase().includes(q) && !(t.trxId ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, filter, search]);

  const unmatched = list.filter((t) => t.status === "UNMATCHED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت تراکنش‌ها"
        description="تمام تراکنش‌های بلاکچین شناسایی‌شده"
        actions={
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو TX/TRX..." className="w-48" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {(Object.keys(LABELS) as Filter[]).map((k) => (
                <option key={k} value={k}>{LABELS[k]}</option>
              ))}
            </select>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">TX hash</th>
                  <th className="text-start font-medium px-4 py-3">TRX</th>
                  <th className="text-start font-medium px-4 py-3">از</th>
                  <th className="text-start font-medium px-4 py-3">به</th>
                  <th className="text-start font-medium px-4 py-3">مبلغ</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ</th>
                  <th className="text-start font-medium px-4 py-3">BSCScan</th>
                </tr>
              </thead>
              <tbody>
                {hydrated && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">رکوردی یافت نشد</td>
                  </tr>
                ) : null}
                {hydrated &&
                  filtered.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{truncateHash(t.txHash)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.trxId ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{truncateAddress(t.fromAddress)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{truncateAddress(t.toAddress)}</td>
                      <td className="px-4 py-3"><MoneyText amount={t.amount} currency={t.currency} /></td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            t.status === "CONFIRMED"
                              ? "success"
                              : t.status === "PENDING"
                              ? "warning"
                              : t.status === "UNMATCHED"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {LABELS[t.status as Filter] ?? t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={t.createdAt} withTime /></td>
                      <td className="px-4 py-3">
                        <a
                          href={bscScanUrl(t.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          مشاهده
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {unmatched.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <CardTitle>تراکنش‌های بدون تطبیق</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-warning/10">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">TX hash</th>
                    <th className="text-start font-medium px-4 py-3">مبلغ</th>
                    <th className="text-start font-medium px-4 py-3">از</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ</th>
                    <th className="text-start font-medium px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((t) => (
                    <tr key={t.id} className="border-t border-warning/20">
                      <td className="px-4 py-3 font-mono text-xs">{truncateHash(t.txHash)}</td>
                      <td className="px-4 py-3"><MoneyText amount={t.amount} currency={t.currency} /></td>
                      <td className="px-4 py-3 font-mono text-xs">{truncateAddress(t.fromAddress)}</td>
                      <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={t.createdAt} /></td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.success("این مورد علامت‌گذاری شد")}
                        >
                          پیگیری
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
