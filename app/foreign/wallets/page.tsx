"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck, Trash2, Wallet as WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useForeignStore } from "@/lib/stores/foreign";
import { TIMINGS } from "@/lib/mock/timings";
import { truncateAddress } from "@/lib/format";

export default function ForeignWalletsPage() {
  const wallets = useForeignStore((s) => s.wallets);
  const addWallet = useForeignStore((s) => s.addWallet);
  const removeWallet = useForeignStore((s) => s.removeWallet);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [signing, setSigning] = useState(false);

  async function handleSign() {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("آدرس BSC معتبر نیست");
      return;
    }
    setSigning(true);
    await new Promise((r) => setTimeout(r, TIMINGS.WALLET_SIGN_MS));
    addWallet({ address, label: label || "New Wallet" });
    toast.success("والت با موفقیت تأیید شد");
    setSigning(false);
    setOpen(false);
    setAddress("");
    setLabel("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت والت"
        description="افزودن و تأیید والت‌های شخصی برای دریافت کریپتو"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                افزودن والت
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>افزودن والت جدید</DialogTitle>
                <DialogDescription>
                  برای تأیید مالکیت، با کیف پول خود یک پیام امضا کنید
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>نام والت</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main Wallet" />
                </div>
                <div className="space-y-1.5">
                  <Label>آدرس BSC</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x..."
                    dir="ltr"
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
                <Button onClick={handleSign} disabled={signing}>
                  {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  تأیید مالکیت با امضا
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">شبکه</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ تأیید</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <WalletIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      هنوز والتی اضافه نکرده‌اید
                    </td>
                  </tr>
                ) : (
                  wallets.map((w) => (
                    <tr key={w.address} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{w.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" dir="ltr">{truncateAddress(w.address)}</span>
                          <CopyButton value={w.address} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{w.network}</td>
                      <td className="px-4 py-3">
                        <Badge tone="success" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><JalaliDate iso={w.verifiedAt} /></td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWallet(w.address)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
