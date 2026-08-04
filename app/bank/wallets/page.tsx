"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Coins, Plus, Power, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/shared/StatCard";
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
import { truncateAddress, formatAmount, formatToken, toPersianDigits } from "@/lib/format";
import { nativeSymbol } from "@/lib/chains";
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
      toast.error("آدرس کیف پول معتبر نیست");
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
                  <Label>آدرس کیف پول</Label>
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
          value={formatToken(totalUsdt, "USDT")}
          icon={WalletIcon}
          tone="success"
          hint={`${formatAmount(usdtRial)} ت`}
        />
        <StatCard
          label={`موجودی ${nativeSymbol()}`}
          value={formatToken(totalBnb, "BNB")}
          icon={Coins}
          tone="success"
          hint={`${formatAmount(bnbRial)} ت`}
        />
        <StatCard
          label="تعداد کیف پول‌ها"
          value={toPersianDigits(wallets.length)}
          icon={WalletIcon}
          tone="success"
        />
        <StatCard
          label="نرخ روز USDT"
          value={`${formatAmount(settings.usdtRate)} ت`}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لیست کیف پول‌ها</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">شبکه</th>
                  <th className="text-start font-medium px-4 py-3">نوع</th>
                  <th className="text-start font-medium px-4 py-3">USDT</th>
                  <th className="text-start font-medium px-4 py-3">{nativeSymbol()}</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                      {formatToken(w.usdtBalance, "USDT")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">
                      {formatToken(w.bnbBalance, "BNB")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={w.active ? "success" : "neutral"}>{w.active ? "فعال" : "غیرفعال"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="whitespace-nowrap"
                        onClick={() => void toggle(w.id, !w.active)}
                      >
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
