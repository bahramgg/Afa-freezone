"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { toPersianDigits, truncateAddress } from "@/lib/format";
import { useLoad } from "@/lib/stores/useLoad";
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
  const freezoneShare = field("freezoneSharePercent");

  const setFeeBasePercent = (v: number) => edit("feeBasePercent", v);
  const setFeeMin = (v: number) => edit("feeMin", v);
  const setFeeMax = (v: number) => edit("feeMax", v);
  const setValidity = (v: number) => edit("invoiceValidityMinutes", v);
  const setMinAmount = (v: number) => edit("invoiceMinAmount", v);
  const setMaxAmount = (v: number) => edit("invoiceMaxAmount", v);
  const setRateTolerance = (v: number) => edit("rateTolerancePercent", v);
  const setFreezoneShare = (v: number) => edit("freezoneSharePercent", v);

  async function saveFee() {
    try {
      await update({
        feeBasePercent,
        feeMin,
        feeMax,
        rateTolerancePercent: rateTolerance,
        freezoneSharePercent: freezoneShare,
      });
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
                  <Label>سهم سازمان از کارمزد (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={freezoneShare}
                    onChange={(e) => setFreezoneShare(Number(e.target.value))}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    کارمزد در همان لحظه بین درگاه و سازمان تقسیم و در دفتر کل ثبت می‌شود.
                  </p>
                </div>
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
              <ContractTerms settingsFee={Number(feeBasePercent)} />
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

type ContractInfo = {
  factory: string;
  feePercent: number;
  freezoneSharePercent: number;
  gatewayWallet: string;
  freezoneWallet: string;
  bankWallet: string;
} | null;

/**
 * What the deployed contract is actually set to do.
 *
 * The numbers above configure a contract that has not been deployed yet. These
 * are the ones that will decide where a payment goes, and the only way to
 * change them is to deploy again — which is what stops anyone redirecting money
 * a buyer has already sent.
 */
function ContractTerms({ settingsFee }: { settingsFee: number }) {
  const [info, setInfo] = useState<ContractInfo>(null);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    const data = await api.post<{ contract: ContractInfo }>("/settings", {});
    setInfo(data.contract);
    setChecked(true);
  }, []);
  useLoad(load);

  if (!checked) return null;

  if (!info) {
    return (
      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
        قرارداد تسویه مستقر نشده است — تا وقتی مستقر نشود، فاکتور تأیید نمی‌شود چون آدرس
        پرداختی برای اعلام وجود ندارد.
      </div>
    );
  }

  const drift = Math.abs(info.feePercent - settingsFee);

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
      <div className="font-medium">آنچه قرارداد مستقرشده انجام می‌دهد</div>
      <dl className="grid gap-1 sm:grid-cols-2">
        <Term label="کارمزد" value={`${toPersianDigits(String(info.feePercent))}٪`} />
        <Term label="سهم سازمان" value={`${toPersianDigits(String(info.freezoneSharePercent))}٪ از کارمزد`} />
        <Term label="کیف پول درگاه" value={truncateAddress(info.gatewayWallet)} mono />
        <Term label="کیف پول سازمان" value={truncateAddress(info.freezoneWallet)} mono />
        <Term label="خزانهٔ بانک" value={truncateAddress(info.bankWallet)} mono />
        <Term label="قرارداد" value={truncateAddress(info.factory)} mono />
      </dl>
      {drift > 0.001 ? (
        <p className="text-warning">
          کارمزد بالا با کارمزد قرارداد یکی نیست. آنچه از پرداخت‌ها کسر می‌شود همان{" "}
          {toPersianDigits(String(info.feePercent))}٪ قرارداد است — برای تغییرش باید قرارداد
          دوباره مستقر شود.
        </p>
      ) : null}
    </div>
  );
}

function Term({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : undefined} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
