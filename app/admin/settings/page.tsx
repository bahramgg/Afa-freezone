"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/lib/stores/settings";

export default function AdminSettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  // Only fields the admin has actually typed into live in local state; every
  // other value reads straight from the store, so a settings refetch is picked
  // up without an effect copying one piece of state into another.
  const [draft, setDraft] = useState<Partial<typeof settings>>({});
  const field = <K extends keyof typeof settings>(key: K) =>
    (draft[key] ?? settings[key]) as (typeof settings)[K];
  const edit = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const feeBasePercent = field("feeBasePercent");
  const feeMin = field("feeMin");
  const feeMax = field("feeMax");
  const validity = field("invoiceValidityMinutes");
  const minAmount = field("invoiceMinAmount");
  const maxAmount = field("invoiceMaxAmount");
  const rateTolerance = field("rateTolerancePercent");

  const setFeeBasePercent = (v: number) => edit("feeBasePercent", v);
  const setFeeMin = (v: number) => edit("feeMin", v);
  const setFeeMax = (v: number) => edit("feeMax", v);
  const setValidity = (v: number) => edit("invoiceValidityMinutes", v);
  const setMinAmount = (v: number) => edit("invoiceMinAmount", v);
  const setMaxAmount = (v: number) => edit("invoiceMaxAmount", v);
  const setRateTolerance = (v: number) => edit("rateTolerancePercent", v);

  async function saveFee() {
    try {
      await update({ feeBasePercent, feeMin, feeMax, rateTolerancePercent: rateTolerance });
      setDraft({});
      toast.success("تنظیمات کارمزد ذخیره شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    }
  }

  async function saveInvoice() {
    try {
      await update({
        invoiceValidityMinutes: validity,
        invoiceMinAmount: minAmount,
        invoiceMaxAmount: maxAmount,
      });
      setDraft({});
      toast.success("تنظیمات فاکتور ذخیره شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="تنظیمات سیستم" description="پیکربندی پارامترهای کلی سیستم" />

      <Tabs defaultValue="fee">
        <TabsList>
          <TabsTrigger value="fee">کارمزد</TabsTrigger>
          <TabsTrigger value="invoice">فاکتور</TabsTrigger>
          <TabsTrigger value="security">امنیت</TabsTrigger>
        </TabsList>

        <TabsContent value="fee" className="mt-4">
          <Card>
            <CardHeader><CardTitle>تنظیمات کارمزد</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>درصد کارمزد پایه (%)</Label>
                  <Input type="number" step="0.1" value={feeBasePercent} onChange={(e) => setFeeBasePercent(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حداقل کارمزد (USDT)</Label>
                  <Input type="number" value={feeMin} onChange={(e) => setFeeMin(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حداکثر کارمزد (USDT)</Label>
                  <Input type="number" value={feeMax} onChange={(e) => setFeeMax(Number(e.target.value))} dir="ltr" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>حد مجاز اختلاف نرخ (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={rateTolerance}
                    onChange={(e) => setRateTolerance(Number(e.target.value))}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    نرخی که بانک قفل می‌کند نباید بیش از این مقدار با نرخ مرجع فاصله داشته باشد.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                کارمزد یک بار در هر مسیر گرفته می‌شود. فاکتوری که پرداخت شود کارمزدش را همان‌جا
                می‌دهد و تسویهٔ خودکاری که از آن ساخته می‌شود کارمزد ندارد.
              </p>
              <Button onClick={saveFee}>ذخیره</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="mt-4">
          <Card>
            <CardHeader><CardTitle>تنظیمات فاکتور</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>مدت اعتبار فاکتور (دقیقه)</Label>
                  <Input type="number" value={validity} onChange={(e) => setValidity(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حداقل مبلغ (USDT)</Label>
                  <Input type="number" value={minAmount} onChange={(e) => setMinAmount(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حداکثر مبلغ (USDT)</Label>
                  <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(Number(e.target.value))} dir="ltr" />
                </div>
              </div>
              <Button onClick={saveInvoice}>ذخیره</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader><CardTitle>امنیت</CardTitle></CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => toast.info("این بخش به‌زودی فعال می‌شود")}>
                تغییر رمز عبور
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
