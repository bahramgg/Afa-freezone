"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";
import { useHydrated } from "@/lib/stores/hydration";

const schema = z.object({
  fullName: z.string().min(1, "نام را وارد کنید"),
  nationalId: z.string().min(1, "کد ملی را وارد کنید"),
  phone: z.string().min(1, "شماره موبایل را وارد کنید"),
  address: z.string().min(1, "آدرس را وارد کنید"),
  freezoneId: z.string().min(1, "شناسه کاربری منطقه آزاد را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const hydrated = useHydrated();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      phone: user?.phone ?? "",
      address: "",
      freezoneId: "",
    },
  });

  useEffect(() => {
    if (hydrated && user) reset({
      fullName: user.fullName ?? "",
      nationalId: user.nationalId ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
      freezoneId: user.freezoneId ?? "",
    });
  }, [hydrated, user, reset]);

  useEffect(() => {
    if (hydrated && !isAuthed) router.replace("/");
  }, [hydrated, isAuthed, router]);

  const onSubmit = async (data: FormValues) => {
    try {
      // Saving a complete profile is what puts the account in the reviewer's
      // queue; there is no separate "submit for review" step.
      await updateProfile(data);
      router.replace("/kyc-waiting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره اطلاعات ناموفق بود");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader>
            <CardTitle>تکمیل پروفایل</CardTitle>
            <CardDescription>
              اطلاعات هویتی خود را وارد کنید تا برای احراز هویت بررسی شود
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">نام و نام خانوادگی</Label>
                <Input id="fullName" placeholder="مثلاً علی محمدی" {...register("fullName")} />
                {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">کد ملی</Label>
                <Input id="nationalId" inputMode="numeric" {...register("nationalId")} />
                {errors.nationalId ? <p className="text-xs text-destructive">{errors.nationalId.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">شماره موبایل</Label>
                <Input id="phone" {...register("phone")} />
                {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="freezoneId">شناسه کاربری منطقه آزاد</Label>
                <Input id="freezoneId" placeholder="GFZ-1405-..." {...register("freezoneId")} />
                {errors.freezoneId ? <p className="text-xs text-destructive">{errors.freezoneId.message}</p> : null}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">آدرس محل سکونت</Label>
                <Input id="address" {...register("address")} />
                {errors.address ? <p className="text-xs text-destructive">{errors.address.message}</p> : null}
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button type="submit" size="lg">
                  ارسال برای احراز هویت
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
