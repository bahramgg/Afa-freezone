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
import { truncateAddress, truncateHash } from "@/lib/format";
import { api } from "@/lib/api/client";
import { explorerUrl } from "@/lib/chains";

type Filter = "ALL" | "CONFIRMED" | "PENDING" | "FAILED" | "UNMATCHED";

const LABELS: Record<Filter, string> = {
  ALL: "همه",
  CONFIRMED: "تأیید شده",
  PENDING: "در انتظار",
  FAILED: "ناموفق",
  UNMATCHED: "بدون تطبیق",
};

/**
 * What the API actually returns, against what this page filters on.
 *
 * The two had drifted apart. `status` carries the chain's view — seen,
 * settling, final — while whether a deposit found an invoice is a separate
 * boolean. Filtering for a status of "UNMATCHED" therefore matched nothing, so
 * the reconciliation queue below rendered for nobody, and "در انتظار" matched
 * nothing either because a settling deposit is CONFIRMING, not PENDING.
 */
const STATUS_LABELS: Record<string, string> = {
  SEEN: "دیده شده",
  CONFIRMING: "در انتظار قطعی‌شدن",
  CONFIRMED: "تأیید شده",
  FAILED: "ناموفق",
};

const matches = (t: { status: string; matched?: boolean }, filter: Filter) => {
  if (filter === "ALL") return true;
  if (filter === "UNMATCHED") return !t.matched;
  if (filter === "PENDING") return t.status === "SEEN" || t.status === "CONFIRMING";
  return t.status === filter;
};

export default function AdminTransactionsPage() {
  const list = useTxStore((s) => s.list);
  const reload = useTxStore((s) => s.load);
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  /**
   * Takes an unmatched deposit on, or puts it back.
   *
   * This button used to raise a success toast and write nothing anywhere. On
   * the one screen that exists for money nobody can account for, telling an
   * operator it was handled when no record was made is worse than having no
   * button at all.
   */
  async function toggleFlag(txHash: string, flagged: boolean) {
    setWorking(txHash);
    try {
      await api.post(`/transactions/${txHash}/flag`, { flagged });
      await reload();
      toast.success(flagged ? "پیگیری این تراکنش به شما سپرده شد" : "پیگیری رها شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت نشد");
    } finally {
      setWorking(null);
    }
  }

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (!matches(t, filter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.txHash.toLowerCase().includes(q) && !(t.trxId ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, filter, search]);

  // Money that arrived at a watched address and belongs to nothing the system
  // knows about. A failed transfer moved nothing, so it is not a claim on anyone.
  const unmatched = list.filter((t) => !t.matched && t.status !== "FAILED");

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
              className="flex h-10 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm tap-grow"
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
                  <th className="text-start font-medium px-4 py-3">کاوشگر</th>
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
                              : t.status === "FAILED"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={t.createdAt} withTime /></td>
                      <td className="px-4 py-3">
                        <a
                          href={explorerUrl(t.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="tap-safe inline-flex items-center gap-1 text-primary hover:underline text-xs"
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
                    <th className="text-start font-medium px-4 py-3">پیگیری</th>
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
                      <td className="px-4 py-3 text-xs">
                        {t.flaggedAt ? (
                          <span className="text-muted-foreground">
                            {t.flaggedBy ?? "—"} · <JalaliDate iso={t.flaggedAt} />
                          </span>
                        ) : (
                          <span className="text-warning">در انتظار بررسی</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          variant={t.flaggedAt ? "ghost" : "outline"}
                          className="min-h-11"
                          disabled={working === t.txHash}
                          onClick={() => toggleFlag(t.txHash, !t.flaggedAt)}
                        >
                          {t.flaggedAt ? "رها کردن" : "پیگیری"}
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
