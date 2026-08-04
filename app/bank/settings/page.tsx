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
import { toPersianDigits, formatAmount } from "@/lib/format";
import { nativeSymbol } from "@/lib/chains";

export default function BankSettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const [usdt, setUsdt] = useState(settings.usdtRate);
  const [bnb, setBnb] = useState(settings.bnbRate);
  const [dailySend, setDailySend] = useState(settings.dailySendLimit);
  const [dailySettle, setDailySettle] = useState(settings.dailySettlementLimit);
  const [minTx, setMinTx] = useState(settings.minTxAmount);

  useEffect(() => {
    setUsdt(settings.usdtRate);
    setBnb(settings.bnbRate);
    setDailySend(settings.dailySendLimit);
    setDailySettle(settings.dailySettlementLimit);
    setMinTx(settings.minTxAmount);
  }, [settings]);

  function saveRates() {
    update({ usdtRate: usdt, bnbRate: bnb });
    toast.success("نرخ‌ها به‌روز شدند");
  }

  function saveLimits() {
    update({ dailySendLimit: dailySend, dailySettlementLimit: dailySettle, minTxAmount: minTx });
    toast.success("تنظیمات ذخیره شد");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="تنظیمات بانک" description="پیکربندی نرخ ارز و سقف تراکنش‌ها" />

      <Tabs defaultValue="rates">
        <TabsList>
          <TabsTrigger value="rates">نرخ ارز</TabsTrigger>
          <TabsTrigger value="limits">سقف تراکنش‌ها</TabsTrigger>
          <TabsTrigger value="security">امنیت</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>نرخ ارز روز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>نرخ USDT به تومان</Label>
                  <Input type="number" value={usdt} onChange={(e) => setUsdt(Number(e.target.value))} dir="ltr" />
                  <p className="text-xs text-muted-foreground">معادل: {toPersianDigits(formatAmount(usdt))} تومان</p>
                </div>
                <div className="space-y-1.5">
                  <Label>نرخ {nativeSymbol()} به تومان</Label>
                  <Input type="number" value={bnb} onChange={(e) => setBnb(Number(e.target.value))} dir="ltr" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                نرخ نمایشی است. در هر مودال تأیید، نرخ قابل ویرایش است و در لحظه تأیید قفل می‌شود.
              </p>
              <Button onClick={saveRates} className="bg-emerald-700 hover:bg-emerald-600">به‌روزرسانی دستی</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>سقف تراکنش‌ها</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>سقف روزانه ارسال (هر کاربر — USDT)</Label>
                  <Input type="number" value={dailySend} onChange={(e) => setDailySend(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>سقف روزانه تسویه (هر کاربر — USDT)</Label>
                  <Input type="number" value={dailySettle} onChange={(e) => setDailySettle(Number(e.target.value))} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>حداقل مبلغ تراکنش (USDT)</Label>
                  <Input type="number" value={minTx} onChange={(e) => setMinTx(Number(e.target.value))} dir="ltr" />
                </div>
              </div>
              <Button onClick={saveLimits} className="bg-emerald-700 hover:bg-emerald-600">ذخیره</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>امنیت</CardTitle>
            </CardHeader>
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
