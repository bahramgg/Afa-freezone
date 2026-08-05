"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Ltr } from "@/components/shared/Ltr";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { SettlementStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useHydrated } from "@/lib/stores/hydration";
import { truncateHash, truncateAddress, toPersianDigits } from "@/lib/format";
import type { Settlement, SettlementStatus } from "@/lib/types";
import { explorerUrl } from "@/lib/chains";

const TABS: { value: SettlementStatus | "ALL" | "WITH_BANK"; label: string }[] = [
  { value: "AWAITING_ADMIN", label: "در انتظار تأیید ادمین" },
  { value: "WITH_BANK", label: "تأیید شده — نزد بانک" },
  { value: "SETTLED", label: "موفق" },
  { value: "REJECTED", label: "رد شده" },
  { value: "ALL", label: "همه" },
];

const WITH_BANK_STATUSES: SettlementStatus[] = [
  "AWAITING_BANK",
  "BANK_RATE_LOCKED",
  "CRYPTO_RECEIVED",
  "CRYPTO_CONFIRMED",
];

export default function AdminSettlementsPage() {
  const list = useSettlementsStore((s) => s.list);
  const adminApprove = useSettlementsStore((s) => s.adminApprove);
  const adminReject = useSettlementsStore((s) => s.adminReject);
  const hydrated = useHydrated();

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("AWAITING_ADMIN");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<Settlement | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const counts = useMemo(() => ({
    AWAITING_ADMIN: list.filter((s) => s.status === "AWAITING_ADMIN").length,
    WITH_BANK: list.filter((s) => WITH_BANK_STATUSES.includes(s.status)).length,
    SETTLED: list.filter((s) => s.status === "SETTLED").length,
    REJECTED: list.filter((s) => s.status === "REJECTED").length,
  }), [list]);

  const filtered = useMemo(() => {
    return list.filter((s) => {
      if (tab === "AWAITING_ADMIN" && s.status !== "AWAITING_ADMIN") return false;
      if (tab === "WITH_BANK" && !WITH_BANK_STATUSES.includes(s.status)) return false;
      if (tab === "SETTLED" && s.status !== "SETTLED") return false;
      if (tab === "REJECTED" && s.status !== "REJECTED") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.trxId.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, tab, search]);

  function handleApprove() {
    if (!reviewing) return;
    adminApprove(reviewing.id);
    toast.success(`${reviewing.trxId} تأیید شد`, { description: "درخواست به بانک ارجاع شد" });
    setReviewing(null);
  }

  function handleReject() {
    if (!reviewing || !rejectReason.trim()) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    adminReject(reviewing.id, rejectReason);
    toast.error(`${reviewing.trxId} رد شد`);
    setReviewing(null);
    setRejectMode(false);
    setRejectReason("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسویه"
        description="درخواست‌های تسویه — بررسی قانونی"
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
            const n = (counts as Record<string, number | undefined>)[t.value] ?? (t.value === "ALL" ? list.length : 0);
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
                      <th className="text-start font-medium px-4 py-3">شماره حساب</th>
                      <th className="text-start font-medium px-4 py-3">تاریخ</th>
                      <th className="text-start font-medium px-4 py-3">وضعیت</th>
                      <th className="text-start font-medium px-4 py-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hydrated || filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">رکوردی نیست</td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                          <td className="px-4 py-3">
                            {s.userName ?? "—"}
                            <div className="text-[10px] text-muted-foreground">{s.userUid ?? ""}</div>
                          </td>
                          <td className="px-4 py-3 truncate max-w-[160px]">{s.goodsTitle}</td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground"><Ltr>{s.payoutAccount}</Ltr></td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                          <td className="px-4 py-3"><SettlementStatusBadge status={s.status} /></td>
                          <td className="px-4 py-3">
                            {s.status === "AWAITING_ADMIN" ? (
                              <Button size="sm" variant="outline" onClick={() => setReviewing(s)}>بررسی</Button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
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

      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setRejectMode(false); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>بررسی درخواست تسویه — {reviewing?.trxId} ({reviewing?.id})</DialogTitle>
            <DialogDescription>پس از تأیید قانونی به بانک ارجاع می‌شود</DialogDescription>
          </DialogHeader>
          {reviewing ? (
            <div className="rounded-md border border-border p-3 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
              <Row label="کاربر" value={`${reviewing.userName ?? "—"} (${reviewing.userUid ?? "—"})`} />
              <Row label="مبلغ" value={<MoneyText amount={reviewing.amount} currency={reviewing.currency} />} />
              <Row label="مشخصات کالا" value={reviewing.goodsTitle} full />
              <Row label="توضیحات" value={reviewing.description} full />
              <Row
                label="هش تراکنش"
                value={
                  <a href={explorerUrl(reviewing.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-primary" dir="ltr">
                    {truncateHash(reviewing.txHash)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
              <Row
                label="آدرس والت"
                value={
                  reviewing.walletAddress ? (
                    <span className="font-mono text-xs flex items-center gap-1" dir="ltr">
                      {truncateAddress(reviewing.walletAddress)}
                      <CopyButton value={reviewing.walletAddress} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">کریپتو نزد بانک است</span>
                  )
                }
              />
              <Row
                label="شماره حساب"
                value={
                  <span className="font-mono text-xs" dir="ltr">
                    {reviewing.payoutAccount ?? "—"}
                  </span>
                }
              />
            </div>
          ) : null}

          {rejectMode ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label>دلیل رد</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          ) : null}

          <DialogFooter>
            {!rejectMode ? (
              <>
                <Button variant="destructive" onClick={() => setRejectMode(true)}>
                  <X className="h-4 w-4" />
                  رد
                </Button>
                <Button variant="success" onClick={handleApprove}>
                  <Check className="h-4 w-4" />
                  تأیید و ارجاع به بانک
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setRejectMode(false)}>انصراف</Button>
                <Button variant="destructive" onClick={handleReject}>تأیید رد</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
