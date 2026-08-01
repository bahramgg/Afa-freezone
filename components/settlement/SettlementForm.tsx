"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { useTxStore } from "@/lib/stores/transactions";
import { useWalletsStore } from "@/lib/stores/wallets";
import { useAuthStore } from "@/lib/stores/auth";
import type { Currency } from "@/lib/types";
import { truncateHash } from "@/lib/format";

const schema = z.object({
  goodsTitle: z.string().min(1, "مشخصات کالا را وارد کنید"),
  description: z.string().min(1, "توضیحات را وارد کنید"),
  txHash: z.string().min(1, "هش تراکنش را انتخاب یا وارد کنید"),
  amount: z.coerce.number().positive("مبلغ باید مثبت باشد"),
  currency: z.enum(["USDT", "BNB"]),
  walletAddress: z.string().min(1, "آدرس کیف پول را انتخاب کنید"),
  bankAccount: z.string().min(1, "شماره حساب را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

export function SettlementForm() {
  const create = useSettlementsStore((s) => s.create);
  const txs = useTxStore((s) => s.list);
  const wallets = useWalletsStore((s) => s.list);
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
      defaultValues: { currency: "USDT" as Currency },
    });

  const onSubmit = (data: FormValues) => {
    const item = create({
      ...data,
      userUid: user?.uid,
      userName: user?.fullName,
    });
    toast.success("درخواست شما به ادمین ارسال شد", {
      description: `${item.trxId} (${item.id}) — منتظر تأیید قانونی ادمین، سپس بانک`,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          درخواست جدید
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>درخواست تسویه به بانک</DialogTitle>
          <DialogDescription>
            مشخصات کامل تراکنش و حساب بانکی خود را برای دریافت تسویه نهایی وارد کنید
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 py-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="goods">مشخصات کالا</Label>
            <Input id="goods" placeholder="مثلاً ۱۰ تن گندم صادراتی" {...register("goodsTitle")} />
            {errors.goodsTitle ? <p className="text-xs text-destructive">{errors.goodsTitle.message}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desc">توضیحات</Label>
            <Textarea id="desc" rows={3} placeholder="مثلاً صادرات به ترکیه — قرارداد ۱۲۳" {...register("description")} />
            {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>هش تراکنش</Label>
            <Select
              value={watch("txHash") ?? ""}
              onValueChange={(v) => setValue("txHash", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب از تراکنش‌های قبلی" />
              </SelectTrigger>
              <SelectContent>
                {txs.map((t) => (
                  <SelectItem key={t.id} value={t.txHash}>
                    {truncateHash(t.txHash)} — {t.amount} {t.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.txHash ? <p className="text-xs text-destructive">{errors.txHash.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>کیف پول</Label>
            <Select
              value={watch("walletAddress") ?? ""}
              onValueChange={(v) => setValue("walletAddress", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کیف پول" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w.address} value={w.address}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.walletAddress ? <p className="text-xs text-destructive">{errors.walletAddress.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">مبلغ</Label>
            <Input id="amount" type="number" step="0.01" {...register("amount")} />
            {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>ارز</Label>
            <Select
              value={watch("currency")}
              onValueChange={(v) => setValue("currency", v as Currency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="BNB">BNB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="iban">شماره حساب / شبا</Label>
            <Input id="iban" placeholder="IR84-0170-0000-0011-2233-44" {...register("bankAccount")} />
            {errors.bankAccount ? <p className="text-xs text-destructive">{errors.bankAccount.message}</p> : null}
          </div>

          <DialogFooter className="sm:col-span-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ارسال به بانک</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
