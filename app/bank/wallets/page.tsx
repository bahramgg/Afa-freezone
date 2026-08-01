"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Power, Wallet as WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { useBankStore } from "@/lib/stores/bank";
import { useSettingsStore } from "@/lib/stores/settings";
import { truncateAddress, formatAmount, toPersianDigits } from "@/lib/format";
import type { BankWalletKind } from "@/lib/types";

const KIND_LABEL: Record<BankWalletKind, string> = {
  SEND: "ارسال",
  RECEIVE: "دریافت",
  SHARED: "مشترک",
};

export default function BankWalletsPage() {
  const wallets = useBankStore((s) => s.wallets);
  const add = useBankStore((s) => s.addWallet);
  const toggle = useBankStore((s) => s.toggleWallet);
  const settings = useSettingsStore((s) => s.settings);

  const totalUsdt = wallets.reduce((a, w) => a + w.usdtBalance, 0);
  const totalBnb = wallets.reduce((a, w) => a + w.bnbBalance, 0);
  const usdtRial = totalUsdt * settings.usdtRate;
  const bnbRial = totalBnb * settings.bnbRate;

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState<BankWalletKind>("SEND");

  function handleAdd() {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("آدرس BSC معتبر نیست");
      return;
    }
    add({ address, label: label || "کیف پول جدید", kind });
    toast.success("کیف پول اضافه شد");
    setOpen(false);
    setAddress("");
    setLabel("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کیف پول‌های بانک"
        description="مدیریت والت‌های بانکی برای ارسال و دریافت کریپتو"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-700 hover:bg-emerald-600">
                <Plus className="h-4 w-4" />
                افزودن کیف پول
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>افزودن کیف پول جدید</DialogTitle>
                <DialogDescription>کیف پول جدید بانکی برای عملیات کریپتو</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>نام کیف پول</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="کیف پول جدید" />
                </div>
                <div className="space-y-1.5">
                  <Label>آدرس BSC</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." dir="ltr" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>نوع کاربری</Label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as BankWalletKind)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="SEND">ارسال</option>
                    <option value="RECEIVE">دریافت</option>
                    <option value="SHARED">مشترک</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
                <Button onClick={handleAdd} className="bg-emerald-700 hover:bg-emerald-600">ثبت</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="موجودی USDT"
          value={<MoneyText amount={totalUsdt} currency="USDT" />}
          icon={WalletIcon}
          hint={`${toPersianDigits(formatAmount(usdtRial))} ت`}
        />
        <StatCard
          label="موجودی BNB"
          value={`${toPersianDigits(totalBnb.toFixed(2))} BNB`}
          icon={WalletIcon}
          hint={`${toPersianDigits(formatAmount(bnbRial))} ت`}
        />
        <StatCard
          label="تعداد کیف پول‌ها"
          value={toPersianDigits(wallets.length)}
          icon={WalletIcon}
        />
        <StatCard
          label="نرخ روز USDT"
          value={`${toPersianDigits(formatAmount(settings.usdtRate))} ت`}
          icon={Power}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست کیف پول‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">شبکه</th>
                  <th className="text-start font-medium px-4 py-3">نوع</th>
                  <th className="text-start font-medium px-4 py-3">USDT</th>
                  <th className="text-start font-medium px-4 py-3">BNB</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.address} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{w.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs" dir="ltr">{truncateAddress(w.address)}</span>
                        <CopyButton value={w.address} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{w.network}</td>
                    <td className="px-4 py-3"><Badge tone="info">{KIND_LABEL[w.kind]}</Badge></td>
                    <td className="px-4 py-3 text-xs">{toPersianDigits(w.usdtBalance)} USDT</td>
                    <td className="px-4 py-3 text-xs">{toPersianDigits(w.bnbBalance)} BNB</td>
                    <td className="px-4 py-3">
                      <Badge tone={w.active ? "success" : "neutral"}>{w.active ? "فعال" : "غیرفعال"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button size="sm" variant="ghost" onClick={() => toggle(w.address)}>
                        <Power className="h-3.5 w-3.5" />
                        {w.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
