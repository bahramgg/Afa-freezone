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
import { useInvoicesStore } from "@/lib/stores/invoices";
import type { Currency } from "@/lib/types";

const schema = z.object({
  senderName: z.string().min(1, "نام ارسال کننده را وارد کنید"),
  goodsTitle: z.string().min(1, "کالای صادره را وارد کنید"),
  amount: z.coerce.number().positive("مبلغ باید مثبت باشد"),
  currency: z.enum(["USDT", "BNB"]),
  description: z.string().min(1, "توضیحات را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

export function CreateInvoiceDialog() {
  const create = useInvoicesStore((s) => s.create);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
      defaultValues: { currency: "USDT" as Currency },
    });

  const onSubmit = async (data: FormValues) => {
    try {
      const inv = await create(data);
      toast.success("فاکتور با موفقیت ایجاد شد", {
        description: `شماره فاکتور: ${inv.id} — منتظر تأیید ادمین`,
      });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت فاکتور ناموفق بود");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          ایجاد فاکتور جدید
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ایجاد فاکتور جدید</DialogTitle>
          <DialogDescription>
            مبلغ و ارز موردنظر را برای فاکتور دریافتی مشخص کنید
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="senderName">ارسال کننده</Label>
            <Input id="senderName" placeholder="مثلاً Anatolia Imports" {...register("senderName")} />
            {errors.senderName ? <p className="text-xs text-destructive">{errors.senderName.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goodsTitle">کالای صادره</Label>
            <Input id="goodsTitle" placeholder="مثلاً ۱۰ تن گندم صادراتی" {...register("goodsTitle")} />
            {errors.goodsTitle ? <p className="text-xs text-destructive">{errors.goodsTitle.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">توضیحات</Label>
            <Textarea id="description" rows={3} placeholder="مثلاً صادرات به آلمان — قرارداد ۸۸۲" {...register("description")} />
            {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">ثبت فاکتور</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
