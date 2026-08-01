"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { SendStatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useSendStore } from "@/lib/stores/send";
import { useHydrated } from "@/lib/stores/hydration";
import { TIMINGS } from "@/lib/mock/timings";
import { truncateAddress, truncateHash, bscScanUrl, toPersianDigits, formatAmount } from "@/lib/format";
import type { Currency, SendRequest } from "@/lib/types";

const schema = z.object({
  counterpartyUid: z.string().min(1, "شناسه کاربر خارجی را وارد کنید"),
  counterpartyName: z.string().optional(),
  amount: z.coerce.number().positive("مبلغ باید مثبت باشد"),
  currency: z.enum(["USDT", "BNB"]),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SendPage() {
  const list = useSendStore((s) => s.list);
  const create = useSendStore((s) => s.create);
  const markPaid = useSendStore((s) => s.markPaid);
  const hydrated = useHydrated();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
      defaultValues: { currency: "USDT" as Currency },
    });

  const [forwarding, setForwarding] = useState<string | null>(null);

  const onSubmit = (data: FormValues) => {
    const item = create(data);
    toast.success("درخواست ارسال شد", {
      description: `${item.trxId} — کاربر خارجی اطلاع داده شد`,
    });
    reset();
  };

  async function handleForward(req: SendRequest) {
    setForwarding(req.id);
    await new Promise((r) => setTimeout(r, TIMINGS.PAYMENT_SIMULATE_MS));
    markPaid(req.id);
    toast.success("ارسال نهایی به کاربر خارجی انجام شد", {
      description: `${formatAmount(req.amount)} ${req.currency} منتقل شد`,
    });
    setForwarding(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ارسال وجه" description="ارسال کریپتو به کاربر خارجی (واردکننده)" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            درخواست جدید
          </CardTitle>
          <CardDescription>
            بعد از تأیید کاربر خارجی، ادمین، و بانک — معادل ریالی را واریز و سپس کریپتو ارسال می‌شود
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="uid">شناسه کاربر خارجی (UID)</Label>
              <Input id="uid" placeholder="FOR-042" {...register("counterpartyUid")} dir="ltr" />
              {errors.counterpartyUid ? (
                <p className="text-xs text-destructive">{errors.counterpartyUid.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">نام کاربر (اختیاری)</Label>
              <Input id="name" placeholder="Michael Chen" {...register("counterpartyName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">مبلغ</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} dir="ltr" />
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>ارز</Label>
              <Select
                value={watch("currency")}
                onValueChange={(v) => setValue("currency", v as Currency)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BNB">BNB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="desc">توضیحات (مثلاً شماره قرارداد)</Label>
              <Textarea id="desc" rows={2} {...register("description")} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">ارسال درخواست</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>درخواست‌های ارسال</CardTitle>
        </CardHeader>
        <CardContent>
          {!hydrated || list.length === 0 ? (
            <EmptyState title="درخواستی وجود ندارد" description="هنوز درخواست ارسالی ثبت نشده است" />
          ) : (
            <div className="space-y-3">
              {list.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{r.trxId}</span>
                        <SendStatusBadge status={r.status} />
                      </div>
                      <div className="text-sm">
                        به <span className="font-medium">{r.counterpartyName ?? r.counterpartyUid}</span>
                        <span className="text-xs text-muted-foreground"> ({r.counterpartyUid})</span>
                      </div>
                    </div>
                    <div className="text-end space-y-0.5">
                      <MoneyText amount={r.amount} currency={r.currency} className="text-base" />
                      <div className="text-xs text-muted-foreground">
                        <JalaliDate iso={r.createdAt} relative />
                      </div>
                    </div>
                  </div>

                  {r.exchangeRate ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-muted-foreground">نرخ ارز ({r.rateLocked ? <span className="text-success">قطعی</span> : <span className="text-warning">تخمینی</span>})</div>
                        <div className="font-medium">{toPersianDigits(formatAmount(r.exchangeRate))} ت</div>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <div className="text-muted-foreground">معادل ریالی</div>
                        <div className="font-medium">{toPersianDigits(formatAmount(r.rialAmount ?? 0))} ت</div>
                      </div>
                    </div>
                  ) : null}

                  {r.status === "BANK_RATE_LOCKED" && r.bankAccount ? (
                    <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                      <div className="font-medium mb-1">منتظر واریز ریال شما</div>
                      <div className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">شماره حساب بانک:</span>
                        <span className="font-mono" dir="ltr">{r.bankAccount}</span>
                        <CopyButton value={r.bankAccount} />
                      </div>
                    </div>
                  ) : null}

                  {r.status === "CRYPTO_SENT" && r.txHashFromBank ? (
                    <div className="mt-3 rounded-md border border-info/30 bg-info/5 p-3 space-y-2 text-sm">
                      <div className="font-medium">کریپتو از بانک به والت شما رسید</div>
                      <div className="text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">TX:</span>
                        <a href={bscScanUrl(r.txHashFromBank)} target="_blank" rel="noreferrer" className="font-mono inline-flex items-center gap-1 hover:text-primary" dir="ltr">
                          {truncateHash(r.txHashFromBank)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleForward(r)}
                        disabled={forwarding === r.id}
                      >
                        {forwarding === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        تأیید و ارسال نهایی به {r.counterpartyName ?? "کاربر خارجی"}
                      </Button>
                    </div>
                  ) : null}

                  {r.status === "PAID" && r.txHashFromBank ? (
                    <div className="mt-3 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">والت گیرنده:</span>
                        <span className="font-mono" dir="ltr">{truncateAddress(r.recipientWalletAddress ?? "")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">TX:</span>
                        <a href={bscScanUrl(r.txHashFromBank)} target="_blank" rel="noreferrer" className="font-mono inline-flex items-center gap-1 hover:text-primary" dir="ltr">
                          {truncateHash(r.txHashFromBank)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {r.status === "REJECTED" && r.rejectReason ? (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                      <div className="text-muted-foreground">دلیل رد ({r.rejectedBy === "BANK" ? "بانک" : "ادمین"}):</div>
                      <div>{r.rejectReason}</div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
