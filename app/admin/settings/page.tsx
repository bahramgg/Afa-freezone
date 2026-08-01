"use client";

import { useEffect, useState } from "react";
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

  const [feeBasePercent, setFeeBasePercent] = useState(settings.feeBasePercent);
  const [feeMin, setFeeMin] = useState(settings.feeMin);
  const [feeMax, setFeeMax] = useState(settings.feeMax);
  const [validity, setValidity] = useState(settings.invoiceValidityMinutes);
  const [minAmount, setMinAmount] = useState(settings.invoiceMinAmount);
  const [maxAmount, setMaxAmount] = useState(settings.invoiceMaxAmount);

  useEffect(() => {
    setFeeBasePercent(settings.feeBasePercent);
    setFeeMin(settings.feeMin);
    setFeeMax(settings.feeMax);
    setValidity(settings.invoiceValidityMinutes);
    setMinAmount(settings.invoiceMinAmount);
    setMaxAmount(settings.invoiceMaxAmount);
  }, [settings]);

  function saveFee() {
    update({ feeBasePercent, feeMin, feeMax });
    toast.success("تنظیمات کارمزد ذخیره شد");
  }

  function saveInvoice() {
    update({ invoiceValidityMinutes: validity, invoiceMinAmount: minAmount, invoiceMaxAmount: maxAmount });
    toast.success("تنظیمات فاکتور ذخیره شد");
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
