"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Logo } from "@/components/shared/Logo";
import { useForeignStore } from "@/lib/stores/foreign";

const schema = z.object({
  fullName: z.string().min(1, "نام را وارد کنید"),
  passportNo: z.string().min(1, "شماره پاسپورت را وارد کنید"),
  country: z.string().min(1, "کشور را انتخاب کنید"),
  phone: z.string().min(1, "شماره تماس را وارد کنید"),
  email: z.string().email("ایمیل معتبر نیست"),
  address: z.string().min(1, "آدرس را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

const COUNTRIES = ["چین", "آلمان", "ترکیه", "روسیه", "امارات", "هند", "ژاپن", "سایر"];

export default function ForeignProfilePage() {
  const router = useRouter();
  const updateProfile = useForeignStore((s) => s.updateProfile);
  const user = useForeignStore((s) => s.user);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      fullName: user?.fullName ?? "",
      passportNo: user?.passportNo ?? "",
      country: user?.country ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      address: user?.address ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    updateProfile(values);
    router.replace("/foreign/kyc-waiting");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/5 to-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Logo />
        <Card>
          <CardHeader>
            <CardTitle>تکمیل پروفایل بین‌المللی</CardTitle>
            <p className="text-sm text-muted-foreground">برای احراز هویت بین‌المللی اطلاعات زیر را وارد کنید</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>نام کامل</Label>
                  <Input {...form.register("fullName")} placeholder="Michael Chen" />
                  {form.formState.errors.fullName ? (
                    <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>شماره پاسپورت / ID خارجی</Label>
                  <Input {...form.register("passportNo")} placeholder="PA1234567" dir="ltr" />
                  {form.formState.errors.passportNo ? (
                    <p className="text-xs text-destructive">{form.formState.errors.passportNo.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>کشور</Label>
                  <select
                    {...form.register("country")}
                    className="tap-grow flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">انتخاب کنید</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {form.formState.errors.country ? (
                    <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>شماره تماس</Label>
                  <Input {...form.register("phone")} dir="ltr" />
                  {form.formState.errors.phone ? (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>ایمیل</Label>
                  <Input {...form.register("email")} dir="ltr" type="email" />
                  {form.formState.errors.email ? (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>آدرس</Label>
                  <Input {...form.register("address")} />
                  {form.formState.errors.address ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
                  ) : null}
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg">
                ادامه و ارسال مدارک
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
