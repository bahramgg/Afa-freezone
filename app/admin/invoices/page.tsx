"use client";

import { useMemo, useState } from "react";
import { Ban, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { CancelImportDialog } from "@/components/invoice/CancelImportDialog";
import { Ltr } from "@/components/shared/Ltr";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { CopyButton } from "@/components/shared/CopyButton";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useHydrated } from "@/lib/stores/hydration";
import { truncateAddress, toPersianDigits } from "@/lib/format";
import type { Invoice, InvoiceStatus } from "@/lib/types";

type AdminTabKey =
  | "ALL"
  | "PENDING"
  | "APPROVED_OR_PENDING_PAYMENT"
  | "WITH_BANK"
  | "PAID"
  | "EXPIRED"
  | "REJECTED"
  | "CANCELLED";

const TABS: { value: AdminTabKey; label: string }[] = [
  { value: "PENDING", label: "در انتظار تأیید" },
  { value: "APPROVED_OR_PENDING_PAYMENT", label: "تأیید شده (در انتظار پرداخت)" },
  // An import spends most of its life here, and until this tab existed those
  // two statuses were reachable only by scrolling "همه".
  { value: "WITH_BANK", label: "واردات نزد بانک" },
  // Cancelled imports live here rather than under "رد شده": one was refused
  // before it started, the other was unwound after money had moved, and an
  // auditor reading the two together would draw the wrong conclusion.
  { value: "CANCELLED", label: "لغو شده" },
  { value: "PAID", label: "موفق" },
  { value: "EXPIRED", label: "منقضی" },
  { value: "REJECTED", label: "رد شده" },
  { value: "ALL", label: "همه" },
];

const ADMIN_STATUSES_FOR: Record<AdminTabKey, InvoiceStatus[] | "ALL"> = {
  ALL: "ALL",
  PENDING: ["PENDING"],
  APPROVED_OR_PENDING_PAYMENT: ["APPROVED", "PAYMENT_PENDING"],
  WITH_BANK: ["BANK_RATE_LOCKED", "RIAL_RECEIVED"],
  PAID: ["PAID"],
  EXPIRED: ["EXPIRED"],
  REJECTED: ["REJECTED"],
  CANCELLED: ["CANCELLING", "CANCELLED"],
};

/**
 * Which way the goods are going, said plainly.
 *
 * Approving an export lets currency into the country; approving an import sends
 * it out. They are not the same decision, and the screen that makes it was not
 * telling the operator which one they were looking at.
 */
function DirectionTag({ direction }: { direction?: "EXPORT" | "IMPORT" }) {
  const importing = direction === "IMPORT";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
        importing ? "bg-info/10 text-info" : "bg-success/10 text-success"
      }`}
    >
      {importing ? "واردات" : "صادرات"}
    </span>
  );
}

export default function AdminInvoicesPage() {
  const list = useInvoicesStore((s) => s.list);
  const approve = useInvoicesStore((s) => s.approve);
  const reject = useInvoicesStore((s) => s.reject);
  const cancelImport = useInvoicesStore((s) => s.cancelImport);
  const hydrated = useHydrated();

  const [tab, setTab] = useState<AdminTabKey>("PENDING");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    list.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const allowed = ADMIN_STATUSES_FOR[tab];
    return list.filter((i) => {
      if (allowed !== "ALL" && !allowed.includes(i.status)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.id.toLowerCase().includes(q) && !i.trxId.toLowerCase().includes(q) && !i.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, tab, search]);

  function handleApprove(inv: Invoice) {
    approve(inv.id);
    toast.success(`فاکتور ${inv.trxId} تأیید شد`, {
      description: "لینک پرداخت برای کاربر صادر شد",
    });
    setReviewing(null);
  }

  function handleReject() {
    if (!reviewing || !rejectReason.trim()) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    reject(reviewing.id, rejectReason);
    toast.error(`فاکتور ${reviewing.trxId} رد شد`);
    setReviewing(null);
    setRejectMode(false);
    setRejectReason("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="دریافت وجه"
        description="فاکتورهای دریافتی کاربران ایرانی"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو TRX/INV/نام..."
            className="w-56"
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          {TABS.map((t) => {
            const allowed = ADMIN_STATUSES_FOR[t.value];
            const n = allowed === "ALL"
              ? list.length
              : allowed.reduce((acc, s) => acc + (counts[s] ?? 0), 0);
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
              {!hydrated || filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">رکوردی نیست</div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-start font-medium px-4 py-3">TRX</th>
                        <th className="text-start font-medium px-4 py-3">INV</th>
                        <th className="text-start font-medium px-4 py-3">جهت</th>
                        <th className="text-start font-medium px-4 py-3">کاربر</th>
                        <th className="text-start font-medium px-4 py-3">مبلغ</th>
                        <th className="text-start font-medium px-4 py-3">والت گیرنده</th>
                        <th className="text-start font-medium px-4 py-3">توضیحات</th>
                        <th className="text-start font-medium px-4 py-3">تاریخ</th>
                        <th className="text-start font-medium px-4 py-3">وضعیت</th>
                        <th className="text-start font-medium px-4 py-3">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv) => (
                        <tr key={inv.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{inv.trxId}</td>
                          <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                          <td className="px-4 py-3">
                            <DirectionTag direction={inv.tradeDirection} />
                          </td>
                          <td className="px-4 py-3">
                            {inv.userName ?? "—"}
                            <div className="text-[10px] text-muted-foreground">{inv.userUid ?? ""}</div>
                          </td>
                          <td className="px-4 py-3"><MoneyText amount={inv.amount} currency={inv.currency} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            <Ltr>{inv.walletAddress ? truncateAddress(inv.walletAddress) : "—"}</Ltr>
                          </td>
                          <td className="px-4 py-3 truncate max-w-[160px] text-muted-foreground">{inv.description ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={inv.createdAt} relative /></td>
                          <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                          <td className="px-4 py-3">
                            {inv.status === "PENDING" ? (
                              <Button size="sm" variant="outline" onClick={() => setReviewing(inv)}>بررسی</Button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setRejectMode(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بررسی فاکتور دریافت — {reviewing?.trxId}</DialogTitle>
            <DialogDescription>{reviewing?.id}</DialogDescription>
          </DialogHeader>
          {reviewing ? (
            <div className="rounded-md border border-border p-3 text-sm space-y-2">
              <Row label="کاربر" value={`${reviewing.userName ?? "—"} (${reviewing.userUid ?? "—"})`} />
              <Row label="ارسال کننده" value={reviewing.senderName || "—"} />
              <Row label="کالای صادره" value={reviewing.goodsTitle || "—"} />
              <Row label="جهت تجارت" value={<DirectionTag direction={reviewing.tradeDirection} />} />
              <Row label="مبلغ" value={<MoneyText amount={reviewing.amount} currency={reviewing.currency} />} />
              <Row label="والت گیرنده" value={reviewing.walletAddress ? (
                <span className="font-mono text-xs flex items-center gap-2" dir="ltr">
                  {truncateAddress(reviewing.walletAddress)}
                  <CopyButton value={reviewing.walletAddress} />
                </span>
              ) : "—"} />
              <Row label="توضیحات" value={reviewing.description || "—"} />
              {reviewing.cancelReason ? (
                <Row
                  label={reviewing.cancelledAt ? "دلیل لغو" : "درخواست لغو"}
                  value={<span className="text-warning">{reviewing.cancelReason}</span>}
                />
              ) : null}
            </div>
          ) : null}
          {rejectMode ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label>دلیل رد</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="دلیل رد..." />
            </div>
          ) : null}
          <DialogFooter>
            {!rejectMode ? (
              <>
                {reviewing &&
                reviewing.tradeDirection === "IMPORT" &&
                ["BANK_RATE_LOCKED", "RIAL_RECEIVED"].includes(reviewing.status) ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setCancelling(reviewing);
                      setReviewing(null);
                    }}
                  >
                    <Ban className="h-4 w-4" />
                    لغو
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => setRejectMode(true)}>
                  <X className="h-4 w-4" />
                  رد
                </Button>
                <Button variant="success" onClick={() => reviewing && handleApprove(reviewing)}>
                  <Check className="h-4 w-4" />
                  تأیید
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

      {cancelling ? (
        <CancelImportDialog
          open
          onOpenChange={(open) => !open && setCancelling(null)}
          mode="cancel"
          invoiceRef={cancelling.id}
          rialHeld={cancelling.status === "RIAL_RECEIVED"}
          onConfirm={(reason) => cancelImport(cancelling.id, reason)}
        />
      ) : null}
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
