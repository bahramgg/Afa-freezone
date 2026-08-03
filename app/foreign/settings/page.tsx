"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { useForeignStore } from "@/lib/stores/foreign";
import { JalaliDate } from "@/components/shared/JalaliDate";

export default function ForeignSettingsPage() {
  const user = useForeignStore((s) => s.user);
  const updateProfile = useForeignStore((s) => s.updateProfile);

  const [editing, setEditing] = useState(false);
  /**
   * `null` means untouched, so the field shows whatever the profile currently
   * holds without copying it into state first.
   *
   * A foreign account is registered with a name, a passport and a country —
   * never a phone or an address — so mirroring those through an effect handed
   * the input `undefined` on the render the profile arrived, which is what
   * turns a controlled input uncontrolled.
   */
  const [draftPhone, setDraftPhone] = useState<string | null>(null);
  const [draftAddress, setDraftAddress] = useState<string | null>(null);
  const phone = draftPhone ?? user?.phone ?? "";
  const address = draftAddress ?? user?.address ?? "";

  function save() {
    updateProfile({ phone, address });
    toast.success("اطلاعات با موفقیت ذخیره شد");
    setDraftPhone(null);
    setDraftAddress(null);
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="تنظیمات" description="مدیریت پروفایل و تنظیمات حساب" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">پروفایل</TabsTrigger>
          <TabsTrigger value="wallets">والت‌ها</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="security">امنیت</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات هویتی</CardTitle>
              <CardDescription>فیلدهای قفل شده قابل ویرایش نیستند</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>نام کامل</Label>
                  <Input value={user?.fullName ?? ""} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    شماره Passport
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input value={user?.passportNo ?? ""} disabled dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    کشور
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input value={user?.country ?? ""} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    ایمیل
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input value={user?.email ?? ""} disabled dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>شماره تماس</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setDraftPhone(e.target.value)}
                    disabled={!editing}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>آدرس</Label>
                  <Input
                    value={address}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    disabled={!editing}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                {editing ? (
                  <>
                    <Button variant="ghost" onClick={() => setEditing(false)}>انصراف</Button>
                    <Button onClick={save}>ذخیره</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setEditing(true)}>ویرایش پروفایل</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>والت‌های شما</CardTitle>
              <CardDescription>مدیریت کامل والت‌ها در صفحه اختصاصی است</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/foreign/wallets">رفتن به مدیریت والت</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>وضعیت KYC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="success" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  تأیید شده
                </Badge>
                <span className="text-sm text-muted-foreground">
                  از {user ? <JalaliDate iso={user.joinedAt} /> : "—"}
                </span>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UID:</span>
                  <span className="font-mono">{user?.uid ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع مدرک:</span>
                  <span>Passport</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>امنیت و اعلان‌ها</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "اعلان از طریق ایمیل", id: "email" },
                { label: "اعلان داخل اپ", id: "in-app" },
              ].map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <Label htmlFor={s.id} className="cursor-pointer">{s.label}</Label>
                  <Switch id={s.id} defaultChecked />
                </div>
              ))}
              <div className="pt-4 border-t border-border space-y-2">
                <Button variant="outline" className="w-full" onClick={() => toast.info("این بخش به‌زودی فعال می‌شود")}>
                  تغییر رمز عبور
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
