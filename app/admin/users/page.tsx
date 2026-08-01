"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Ltr } from "@/components/shared/Ltr";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
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
import { useAdminUsersStore } from "@/lib/stores/adminUsers";
import { useKycStore } from "@/lib/stores/kyc";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits, truncateAddress } from "@/lib/format";
import type { AdminUserRecord } from "@/lib/types";

type KycFilter = "ALL" | "APPROVED" | "PENDING" | "REJECTED";
type TypeFilter = "ALL" | "IRANIAN" | "FOREIGN";

export default function AdminUsersPage() {
  const users = useAdminUsersStore((s) => s.list);
  const reloadUsers = useAdminUsersStore((s) => s.load);
  const approveRequest = useKycStore((s) => s.approveRequest);
  const rejectRequest = useKycStore((s) => s.rejectRequest);
  useLoad(reloadUsers);
  const [kycFilter, setKycFilter] = useState<KycFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRecord | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (kycFilter !== "ALL" && u.kyc !== kycFilter) return false;
      if (typeFilter !== "ALL" && u.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !u.fullName.toLowerCase().includes(q) &&
          !u.uid.toLowerCase().includes(q) &&
          !(u.nationalId ?? "").includes(q) &&
          !(u.passportNo ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [users, kycFilter, typeFilter, search]);

  async function approveKyc(uid: string) {
    try {
      await approveRequest(uid);
      await reloadUsers();
      toast.success(`KYC کاربر ${uid} تأیید شد`);
      setSelected((s) => (s ? { ...s, kyc: "APPROVED", kycRejectReason: undefined } : s));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تأیید ناموفق بود");
    }
  }

  async function rejectKyc() {
    if (!selected || !rejectReason.trim()) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    try {
      await rejectRequest(selected.uid, rejectReason);
      await reloadUsers();
      toast.error(`KYC کاربر ${selected.uid} رد شد`);
      setSelected({ ...selected, kyc: "REJECTED", kycRejectReason: rejectReason });
      setRejectMode(false);
      setRejectReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "رد کردن ناموفق بود");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="مدیریت کاربران" description="کاربران ایرانی و خارجی + بررسی KYC" />

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام، UID، کد ملی، Passport..." />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">همه — ایرانی + خارجی</option>
            <option value="IRANIAN">ایرانی</option>
            <option value="FOREIGN">خارجی</option>
          </select>
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value as KycFilter)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">KYC: همه</option>
            <option value="APPROVED">KYC: تأیید شده</option>
            <option value="PENDING">KYC: در انتظار</option>
            <option value="REJECTED">KYC: رد شده</option>
          </select>
          <Button variant="outline" onClick={() => { setSearch(""); setKycFilter("ALL"); setTypeFilter("ALL"); }}>
            حذف فیلترها
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">UID</th>
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">نوع</th>
                  <th className="text-start font-medium px-4 py-3">مدرک</th>
                  <th className="text-start font-medium px-4 py-3">KYC</th>
                  <th className="text-start font-medium px-4 py-3">تراکنش‌ها</th>
                  <th className="text-start font-medium px-4 py-3">حجم</th>
                  <th className="text-start font-medium px-4 py-3">عضویت</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.uid} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{u.uid}</td>
                    <td className="px-4 py-3">{u.fullName}</td>
                    <td className="px-4 py-3 text-xs">
                      <Badge tone={u.type === "IRANIAN" ? "info" : "primary"}>
                        {u.type === "IRANIAN" ? "ایرانی" : "خارجی"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      <Ltr>{u.type === "IRANIAN" ? u.nationalId : u.passportNo}</Ltr>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.kyc === "APPROVED" ? "success" : u.kyc === "PENDING" ? "warning" : "destructive"}>
                        {u.kyc === "APPROVED" ? "تأیید شده" : u.kyc === "PENDING" ? "در انتظار" : "رد شده"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{toPersianDigits(u.invoiceCount)}</td>
                    <td className="px-4 py-3"><MoneyText amount={u.volume} currency="USDT" /></td>
                    <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={u.joinedAt} /></td>
                    <td className="px-4 py-3 text-end">
                      <Button size="sm" variant="outline" onClick={() => setSelected(u)}>مشاهده</Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">کاربری یافت نشد</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setRejectMode(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.fullName} ({selected?.uid})</DialogTitle>
            <DialogDescription>
              {selected?.type === "IRANIAN" ? "کاربر ایرانی" : "کاربر خارجی"}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <Tabs defaultValue="identity">
              <TabsList>
                <TabsTrigger value="identity">هویتی</TabsTrigger>
                <TabsTrigger value="kyc">KYC</TabsTrigger>
                <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
                <TabsTrigger value="wallets">والت‌ها</TabsTrigger>
              </TabsList>
              <TabsContent value="identity" className="mt-3 space-y-2 text-sm">
                <Row label="نام کامل" value={selected.fullName} />
                <Row label={selected.type === "IRANIAN" ? "کد ملی" : "شماره پاسپورت"} value={selected.nationalId ?? selected.passportNo ?? "—"} />
                {selected.country ? <Row label="کشور" value={selected.country} /> : null}
                <Row label="شماره موبایل/تماس" value={<span dir="ltr" className="font-mono text-xs">{selected.phone ?? "—"}</span>} />
                <Row label="ایمیل" value={<span dir="ltr" className="text-xs">{selected.email ?? "—"}</span>} />
                <Row label="آدرس" value={selected.address ?? "—"} />
                {selected.freezoneId ? <Row label="شناسه منطقه آزاد" value={selected.freezoneId} /> : null}
                <Row label="تاریخ عضویت" value={<JalaliDate iso={selected.joinedAt} />} />
              </TabsContent>
              <TabsContent value="kyc" className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone={selected.kyc === "APPROVED" ? "success" : selected.kyc === "PENDING" ? "warning" : "destructive"}>
                    {selected.kyc === "APPROVED" ? "تأیید شده" : selected.kyc === "PENDING" ? "در انتظار" : "رد شده"}
                  </Badge>
                </div>
                {selected.kyc === "REJECTED" && selected.kycRejectReason ? (
                  <p className="text-xs text-destructive">دلیل رد: {selected.kycRejectReason}</p>
                ) : null}
                {selected.kyc === "PENDING" ? (
                  <div className="flex gap-2 pt-2">
                    <Button variant="success" onClick={() => approveKyc(selected.uid)}>
                      <Check className="h-4 w-4" />
                      تأیید KYC
                    </Button>
                    <Button variant="destructive" onClick={() => setRejectMode(true)}>
                      <X className="h-4 w-4" />
                      رد KYC
                    </Button>
                  </div>
                ) : null}
                {rejectMode ? (
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <Label>دلیل رد</Label>
                    <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setRejectMode(false)}>انصراف</Button>
                      <Button variant="destructive" size="sm" onClick={rejectKyc}>تأیید رد</Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="transactions" className="mt-3 text-sm">
                <p className="text-muted-foreground">
                  تعداد کل تراکنش‌ها: {toPersianDigits(selected.invoiceCount)} — حجم: <MoneyText amount={selected.volume} currency="USDT" />
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  جزئیات کامل از مانیتور تراکنش‌ها قابل دسترسی است.
                </p>
              </TabsContent>
              <TabsContent value="wallets" className="mt-3 text-sm space-y-2">
                <p className="text-muted-foreground text-xs">
                  والت‌های متصل کاربر — نمایش از مدیریت والت‌ها
                </p>
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="font-mono text-xs flex items-center justify-between" dir="ltr">
                    <span>{truncateAddress("0x3a9f7b2c4d8e1a5f9c2b8d4e7a1f3c5b9d2e6a8f")}</span>
                    <Badge tone="success">تأیید شده</Badge>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>بستن</Button>
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
