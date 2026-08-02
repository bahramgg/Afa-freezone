"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useSendStore } from "@/lib/stores/send";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { truncateAddress } from "@/lib/format";
import type { SendRequest } from "@/lib/types";

type TabKey = "WAITING_ME" | "APPROVED";

export default function ForeignRequestsPage() {
  const router = useRouter();
  const sends = useSendStore((s) => s.list);
  const approveCounterparty = useSendStore((s) => s.approveCounterparty);
  const user = useForeignStore((s) => s.user);
  const wallets = useForeignStore((s) => s.wallets);
  const hydrated = useHydrated();

  const [tab, setTab] = useState<TabKey>("WAITING_ME");
  const [openItem, setOpenItem] = useState<SendRequest | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string>("");

  const my = sends.filter((s) => s.counterpartyUid === user?.uid);

  const waiting = my.filter((s) => s.status === "AWAITING_COUNTERPARTY");
  const approved = my.filter((s) => s.status !== "AWAITING_COUNTERPARTY" && s.status !== "REJECTED");
  const filtered = tab === "WAITING_ME" ? waiting : approved;

  function handleApprove() {
    if (!openItem || !selectedWallet) return;
    approveCounterparty(openItem.id, selectedWallet);
    toast.success("والت تأیید شد", {
      description: "صفحه پرداخت ایجاد شد — می‌توانید آن را با کاربر ایرانی به اشتراک بگذارید",
    });
    const id = openItem.id;
    setOpenItem(null);
    setSelectedWallet("");
    router.push(`/foreign/requests/${id}/payment`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="دریافت وجه (بازنشسته)"
        description="درخواست‌های ثبت‌شده پیش از بازنشستگی این مسیر — درخواست تازه‌ای اضافه نمی‌شود"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full">
          <TabsTrigger value="WAITING_ME" className="text-xs gap-1.5">
            در انتظار تأیید من
            {hydrated && waiting.length > 0 ? (
              <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white">
                {waiting.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="APPROVED" className="text-xs">
            تأیید شده
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-start font-medium px-4 py-3">TRX</th>
                      <th className="text-start font-medium px-4 py-3">فرستنده</th>
                      <th className="text-start font-medium px-4 py-3">مبلغ</th>
                      <th className="text-start font-medium px-4 py-3">والت دریافت</th>
                      <th className="text-start font-medium px-4 py-3">تاریخ</th>
                      <th className="text-start font-medium px-4 py-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hydrated || filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          {tab === "WAITING_ME"
                            ? "درخواست جدیدی برای تأیید وجود ندارد"
                            : "هنوز درخواستی تأیید نکرده‌اید"}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((s) => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{s.trxId}</td>
                          <td className="px-4 py-3">{s.userName ?? s.userUid ?? "—"}</td>
                          <td className="px-4 py-3"><MoneyText amount={s.amount} currency={s.currency} /></td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {s.recipientWalletAddress ? truncateAddress(s.recipientWalletAddress) : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={s.createdAt} /></td>
                          <td className="px-4 py-3">
                            {s.status === "AWAITING_COUNTERPARTY" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setOpenItem(s);
                                  setSelectedWallet(wallets[0]?.address ?? "");
                                }}
                              >
                                تأیید والت
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/foreign/requests/${s.id}/payment`)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                مشاهده صفحه پرداخت
                              </Button>
                            )}
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

      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأیید والت دریافت</DialogTitle>
            <DialogDescription>
              یکی از والت‌های تأییدشده خود را برای دریافت کریپتو انتخاب کنید — پس از تأیید، صفحه پرداخت ایجاد می‌شود
            </DialogDescription>
          </DialogHeader>

          {openItem ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TRX</span>
                  <span className="font-mono">{openItem.trxId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">فرستنده</span>
                  <span>{openItem.userName ?? openItem.userUid ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">مبلغ</span>
                  <MoneyText amount={openItem.amount} currency={openItem.currency} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>انتخاب والت دریافت</Label>
                {wallets.length === 0 ? (
                  <p className="text-xs text-destructive">
                    ابتدا از بخش مدیریت والت یک والت اضافه کنید
                  </p>
                ) : (
                  <select
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono"
                  >
                    {wallets.map((w) => (
                      <option key={w.address} value={w.address}>
                        {w.label} — {truncateAddress(w.address)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <Badge tone="info" className="text-[10px]">
                پس از تأیید، یک صفحه پرداخت با QR و آدرس والت شما ایجاد می‌شود
              </Badge>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenItem(null)}>انصراف</Button>
            <Button onClick={handleApprove} disabled={!selectedWallet}>
              <CheckCircle2 className="h-4 w-4" />
              تأیید و ایجاد صفحه پرداخت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
