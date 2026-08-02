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
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatAmount, toPersianDigits } from "@/lib/format";

/**
 * The foreign seller bills an Iranian importer.
 *
 * They enter the figure on their commercial contract and nothing else. The fee
 * is added on top rather than taken out of it, so what arrives in their wallet
 * is the number they typed — the importer pays the difference. The preview
 * below is worked out the same way the server does it, but the invoice's own
 * figure is what binds.
 */
const schema = z.object({
  counterpartyUid: z.string().min(2, "شناسهٔ واردکنندهٔ ایرانی را وارد کنید"),
  goodsTitle: z.string().min(1, "عنوان کالا را وارد کنید"),
  amount: z.coerce.number().positive("مبلغ باید مثبت باشد"),
  currency: z.literal("USDT"),
  beneficiaryWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "آدرس کیف پول معتبر نیست"),
  description: z.string().min(1, "توضیحات را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

export function CreateImportInvoiceDialog() {
  const create = useInvoicesStore((s) => s.create);
  const settings = useSettingsStore((s) => s.settings);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: { currency: "USDT" },
  });

  const amount = Number(watch("amount")) || 0;
  const percent = settings.feeBasePercent;
  const fee =
    amount > 0
      ? Math.min(Math.max((amount * percent) / 100, settings.feeMin), settings.feeMax)
      : 0;

  const onSubmit = async (data: FormValues) => {
    try {
      const invoice = await create({ ...data, direction: "IMPORT" });
      toast.success("فاکتور صادر شد", {
        description: `شماره ${invoice.id} — در انتظار تأیید سازمان`,
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
          صدور فاکتور فروش
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>صدور فاکتور فروش به واردکنندهٔ ایرانی</DialogTitle>
          <DialogDescription>
            مبلغ اصل قرارداد را وارد کنید؛ کارمزد را سامانه روی آن اضافه می‌کند
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="counterpartyUid">شناسهٔ واردکنندهٔ ایرانی</Label>
            <Input
              id="counterpartyUid"
              placeholder="IRN-018"
              dir="ltr"
              className="font-mono"
              {...register("counterpartyUid")}
            />
            {errors.counterpartyUid ? (
              <p className="text-xs text-destructive">{errors.counterpartyUid.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                واردکننده باید در سامانه ثبت‌نام کرده و شناسه‌اش را به شما داده باشد. فاکتور در
                داشبورد خودش نمایش داده می‌شود.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goodsTitle">عنوان کالا</Label>
            <Input id="goodsTitle" placeholder="مثلاً ۲۰۰ دستگاه قطعات صنعتی" {...register("goodsTitle")} />
            {errors.goodsTitle ? (
              <p className="text-xs text-destructive">{errors.goodsTitle.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">مبلغ اصل قرارداد</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount ? (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>ارز</Label>
              {/* USDT only: the watcher reads BEP-20 Transfer logs, and a native
                  BNB transfer emits none. */}
              <Input value="USDT" readOnly dir="ltr" className="font-mono" />
            </div>
          </div>

          {amount > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">سهم شما</span>
                <span>{toPersianDigits(formatAmount(amount))} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  کارمزد سامانه ({toPersianDigits(percent)}٪)
                </span>
                <span>{toPersianDigits(formatAmount(fee))} USDT</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <span>پرداختی واردکننده</span>
                <span>{toPersianDigits(formatAmount(amount + fee))} USDT</span>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="beneficiaryWallet">کیف پول شما برای دریافت وجه</Label>
            <Input
              id="beneficiaryWallet"
              placeholder="0x…"
              dir="ltr"
              className="font-mono"
              {...register("beneficiaryWallet")}
            />
            {errors.beneficiaryWallet ? (
              <p className="text-xs text-destructive">{errors.beneficiaryWallet.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                قرارداد تسویه، اصل مبلغ را مستقیماً به همین آدرس واریز می‌کند. پس از تأیید سازمان
                قابل تغییر نیست.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">توضیحات</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="مثلاً فروش به ایران — قرارداد ۲۴۱"
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              ثبت فاکتور
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
