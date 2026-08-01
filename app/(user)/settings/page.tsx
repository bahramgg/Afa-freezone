"use client";

import { useState } from "react";
import { Lock, Plus, ShieldCheck, Trash2, Loader2, Wallet as WalletIcon, Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
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
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useAuthStore } from "@/lib/stores/auth";
import { useWalletsStore } from "@/lib/stores/wallets";
import { TIMINGS } from "@/lib/mock/timings";
import { truncateAddress } from "@/lib/format";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const wallets = useWalletsStore((s) => s.list);
  const addWallet = useWalletsStore((s) => s.add);
  const removeWallet = useWalletsStore((s) => s.remove);

  // The draft only exists while editing; otherwise the store is the source of
  // truth, so there is no effect syncing one piece of state into another.
  const [draftAddress, setDraftAddress] = useState<string | null>(null);
  const editing = draftAddress !== null;
  const address = draftAddress ?? user?.address ?? "";

  function saveProfile() {
    updateProfile({ address });
    toast.success("اطلاعات با موفقیت ذخیره شد");
    setDraftAddress(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="تنظیمات" description="مدیریت پروفایل، والت‌ها و تنظیمات حساب" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">پروفایل</TabsTrigger>
          <TabsTrigger value="wallets">مدیریت والت‌ها</TabsTrigger>
          <TabsTrigger value="kyc">وضعیت KYC</TabsTrigger>
          <TabsTrigger value="security">امنیت و اعلان‌ها</TabsTrigger>
        </TabsList>

        {/* PROFILE */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات پروفایل</CardTitle>
              <CardDescription>برخی فیلدها پس از احراز هویت قفل می‌شوند</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <LockedField label="نام و نام خانوادگی" value={user?.fullName} />
              <LockedField label="شماره موبایل" value={user?.phone} />
              <LockedField label="کد ملی" value={user?.nationalId} />
              <LockedField label="ایمیل" value={user?.email} />
              <LockedField label="شناسه منطقه آزاد" value={user?.freezoneId ?? "—"} />
              <LockedField label="شناسه کاربری" value={user?.uid} />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">آدرس محل سکونت</Label>
                <Input
                  id="address"
                  value={address}
                  disabled={!editing}
                  onChange={(e) => setDraftAddress(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                {editing ? (
                  <>
                    <Button variant="outline" onClick={() => setDraftAddress(null)}>
                      انصراف
                    </Button>
                    <Button onClick={saveProfile}>ذخیره</Button>
                  </>
                ) : (
                  <Button onClick={() => setDraftAddress(user?.address ?? "")}>
                    ویرایش پروفایل
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WALLETS */}
        <TabsContent value="wallets">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <WalletIcon className="h-5 w-5 text-primary" />
                  والت‌های متصل
                </CardTitle>
                <CardDescription>کیف پول‌های BSC تأیید‌شده شما</CardDescription>
              </div>
              <AddWalletDialog onAdd={addWallet} />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wallets.map((w) => (
                  <div
                    key={w.address}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <WalletIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{w.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {truncateAddress(w.address, 8, 6)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{w.network}</Badge>
                      <Badge tone="success" className="gap-1">
                        <Check className="h-3 w-3" />
                        تأیید شده
                      </Badge>
                      <span className="hidden sm:inline text-xs text-muted-foreground">
                        <JalaliDate iso={w.verifiedAt} />
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeWallet(w.address)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle>وضعیت احراز هویت</CardTitle>
              <CardDescription>اطلاعات احراز هویت و مدارک ارسال‌شده</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">احراز هویت شما تأیید شده است</div>
                  <div className="text-xs text-muted-foreground">
                    تاریخ تأیید: {user ? <JalaliDate iso={user.joinedAt} /> : "—"}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="شناسه کاربری" value={user?.uid} />
                <Field label="کد ملی" value={user?.nationalId} />
                <Field label="نام کامل" value={user?.fullName} />
                <Field label="تاریخ عضویت" value={user ? <JalaliDate iso={user.joinedAt} /> : "—"} />
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-2">مدارک ارسال شده</div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> اسکن کارت ملی</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> اسکن صفحه اول شناسنامه</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> سلفی با کارت ملی</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> مدرک سکونت</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  تنظیمات اعلان‌ها
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow label="اعلان از طریق ایمیل" defaultChecked />
                <ToggleRow label="اعلان از طریق پیامک" defaultChecked />
                <ToggleRow label="اعلان داخل اپ" defaultChecked />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  امنیت
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ComingSoonButton label="تغییر رمز عبور" />
                <ComingSoonButton label="فعال‌سازی احراز هویت دو مرحله‌ای" />
                <ComingSoonButton label="مشاهده دستگاه‌های فعال" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LockedField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 h-10 text-sm">
        <span className="flex-1 truncate">{value ?? "—"}</span>
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-sm">{value}</div>
    </div>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function ComingSoonButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              این قابلیت به‌زودی در دسترس قرار می‌گیرد. در صورت نیاز فوری با پشتیبانی تماس بگیرید.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>متوجه شدم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddWalletDialog({
  onAdd,
}: {
  onAdd: (w: { address: string; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [signing, setSigning] = useState(false);

  async function submit() {
    if (!address.trim() || !label.trim()) {
      toast.error("همه فیلدها الزامی است");
      return;
    }
    setSigning(true);
    await new Promise((r) => setTimeout(r, TIMINGS.WALLET_SIGN_MS));
    onAdd({ address, label });
    toast.success("والت با موفقیت تأیید شد");
    setSigning(false);
    setAddress("");
    setLabel("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          افزودن والت جدید
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>افزودن والت جدید</DialogTitle>
          <DialogDescription>برای تأیید مالکیت، یک پیام امضا خواهید کرد</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="addr">آدرس والت (BSC)</Label>
            <Input
              id="addr"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">نام والت</Label>
            <Input
              id="label"
              placeholder="مثلاً والت اصلی"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={signing}>
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            تأیید مالکیت با امضا
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
