"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { useSendStore } from "@/lib/stores/send";
import { useHydrated } from "@/lib/stores/hydration";
import { truncateAddress, toPersianDigits } from "@/lib/format";
import type { SendRequest, SendStatus } from "@/lib/types";

const TABS: { value: SendStatus | "ALL" | "APPROVED"; label: string }[] = [
  { value: "AWAITING_ADMIN", label: "در انتظار تأیید" },
  { value: "APPROVED", label: "تأیید شده (نزد بانک)" },
  { value: "PAID", label: "موفق" },
  { value: "REJECTED", label: "رد شده" },
  { value: "ALL", label: "همه" },
];

const APPROVED_LIST: SendStatus[] = [
  "AWAITING_BANK_REVIEW",
  "BANK_RATE_LOCKED",
  "RIAL_RECEIVED",
  "CRYPTO_SENT",
];

export default function AdminSendPage() {
  const sends = useSendStore((s) => s.list);
  const approveAdmin = useSendStore((s) => s.approveAdmin);
  const rejectAdmin = useSendStore((s) => s.rejectAdmin);
  const hydrated = useHydrated();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("AWAITING_ADMIN");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<SendRequest | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const counts = useMemo(() => {
    return {
      AWAITING_ADMIN: sends.filter((s) => s.status === "AWAITING_ADMIN").length,
      APPROVED: sends.filter((s) => APPROVED_LIST.includes(s.status)).length,
      PAID: sends.filter((s) => s.status === "PAID").length,
      REJECTED: sends.filter((s) => s.status === "REJECTED").length,
    };
  }, [sends]);

  const filtered = useMemo(() => {
    return sends.filter((s) => {
      if (tab === "AWAITING_ADMIN" && s.status !== "AWAITING_ADMIN") return false;
      if (tab === "APPROVED" && !APPROVED_LIST.includes(s.status)) return false;
      if (tab === "PAID" && s.status !== "PAID") return false;
      if (tab === "REJECTED" && s.status !== "REJECTED") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.trxId.toLowerCase().includes(q) && !s.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [sends, tab, search]);

  function handleApprove() {
    if (!reviewing) return;
    approveAdmin(reviewing.id);
    toast.success(`${reviewing.trxId} تأیید شد`, {
      description: "درخواست به بانک ارجاع شد",
    });
    setReviewing(null);
  }

  function handleReject() {
    if (!reviewing || !rejectReason.trim()) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    rejectAdmin(reviewing.id, rejectReason);
    toast.error(`${reviewing.trxId} رد شد`);
    setReviewing(null);
    setRejectMode(false);
    setRejectReason("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ارسال وجه (بازنشسته)"
        description="درخواست‌های باقی‌مانده از مسیر قدیمی واردات — بررسی قانونی توسط ادمین"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="w-56"
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          {TABS.map((t) => {
            const n = (counts as Record<string, number | undefined>)[t.value] ?? (t.value === "ALL" ? sends.length : 0);
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
                      <th className="text-start font-medium px-4 py-3">توضیحات</th>
                      <th className="text-start font-medium px-4 py-3">تاریخ</th>
                      <th className="text-start font-medium px-4 py-3">وضعیت</th>
                      <th className="text-start font-medium px-4 py-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hydrated || filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">رکوردی نیست</td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3">
                            {s.userName ?? "—"}
                            <div className="text-[10px] text-muted-foreground">{s.userUid ?? ""}</div>
                          </td>
                          <td className="px-4 py-3">
                            {s.counterpartyName ?? "—"}
                            <div className="text-[10px] text-muted-foreground font-mono">{s.counterpartyUid}</div>
                          </td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 truncate max-w-[160px] text-muted-foreground">{s.description ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                          <td className="px-4 py-3"><SendStatusBadge status={s.status} /></td>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بررسی درخواست ارسال — {reviewing?.trxId}</DialogTitle>
            <DialogDescription>تأیید قانونی — بعد از تأیید به بانک ارجاع می‌شود</DialogDescription>
          </DialogHeader>
          {reviewing ? (
            <div className="rounded-md border border-border p-3 text-sm space-y-2">
              <Row label="کاربر ایرانی" value={`${reviewing.userName ?? "—"} (${reviewing.userUid ?? "—"})`} />
              <Row label="کاربر خارجی" value={`${reviewing.counterpartyName ?? "—"} (${reviewing.counterpartyUid})`} />
              <Row label="والت گیرنده" value={reviewing.recipientWalletAddress ? (
                <span className="font-mono text-xs flex items-center gap-2" dir="ltr">
                  {truncateAddress(reviewing.recipientWalletAddress)}
                  <CopyButton value={reviewing.recipientWalletAddress} />
                </span>
              ) : "—"} />
              <Row label="مبلغ" value={<MoneyText amount={reviewing.amount} currency={reviewing.currency} />} />
              <Row label="توضیحات / قرارداد" value={reviewing.description ?? "—"} />
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span>{value}</span>
    </div>
  );
}
