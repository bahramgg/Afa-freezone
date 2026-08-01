"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, Loader2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/shared/CopyButton";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { api, ApiClientError } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { truncateAddress, truncateHash, toPersianDigits, formatAmount } from "@/lib/format";

/**
 * What buyers have paid, and where it is sitting.
 *
 * Each payment lands at an address derived for its own invoice, so the money
 * arrives spread across as many addresses as there were payments. The operator
 * moves each balance into the treasury with their own wallet — the gateway
 * holds no key to any of them — and records the hash here, which is what the
 * books are written from.
 */

type Deposit = {
  id: string;
  index: number;
  address: string;
  invoiceRef?: string;
  currency: string;
  receivedAmount: number;
  swept: boolean;
  sweptAt?: string;
  sweepTxHash?: string;
};

export default function DepositsPage() {
  const [list, setList] = useState<Deposit[]>([]);
  const [hash, setHash] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Deposit[] }>("/deposits").catch(() => null);
    if (data) setList(data.list);
  }, []);

  useLoad(load);

  async function sweep(id: string) {
    const txHash = (hash[id] ?? "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      toast.error("هش تراکنش معتبر نیست");
      return;
    }
    setBusy(id);
    try {
      await api.post("/deposits", { id, txHash });
      toast.success("برداشت ثبت شد و در دفتر کل نوشته شد");
      setHash((h) => ({ ...h, [id]: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "ثبت برداشت انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  const pending = list.filter((d) => !d.swept && d.receivedAmount > 0);
  const total = pending.reduce((sum, d) => sum + d.receivedAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="آدرس‌های واریز"
        description="وجوه دریافتی از خریداران و انتقال آن‌ها به خزانه بانک"
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">در انتظار برداشت</div>
              <div className="text-lg font-semibold">
                {toPersianDigits(formatAmount(total))} USDT
              </div>
            </div>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            انتقال را با کیف پول خودتان انجام دهید — سامانه کلید هیچ‌کدام از این آدرس‌ها را
            ندارد — سپس هش را اینجا ثبت کنید تا روی زنجیره بررسی شود.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">فاکتور</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">موجودی</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">برداشت</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      هنوز آدرس واریزی ساخته نشده است
                    </td>
                  </tr>
                ) : (
                  list.map((d) => (
                    <tr key={d.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-mono text-xs">{d.invoiceRef ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ltr className="font-mono text-xs">{truncateAddress(d.address)}</Ltr>
                          <CopyButton value={d.address} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {toPersianDigits(formatAmount(d.receivedAmount))} {d.currency}
                      </td>
                      <td className="px-4 py-3">
                        {d.swept ? (
                          <div className="space-y-1">
                            <Badge tone="success">برداشت شد</Badge>
                            {d.sweepTxHash ? (
                              <Ltr className="block font-mono text-[10px] text-muted-foreground">
                                {truncateHash(d.sweepTxHash)}
                              </Ltr>
                            ) : null}
                          </div>
                        ) : d.receivedAmount > 0 ? (
                          <Badge tone="warning">در انتظار برداشت</Badge>
                        ) : (
                          <Badge tone="info">در انتظار پرداخت</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d.swept ? (
                          <span className="text-xs text-muted-foreground">
                            <JalaliDate iso={d.sweptAt ?? ""} />
                          </span>
                        ) : d.receivedAmount > 0 ? (
                          <div className="flex gap-2">
                            <Input
                              value={hash[d.id] ?? ""}
                              onChange={(e) => setHash((h) => ({ ...h, [d.id]: e.target.value }))}
                              placeholder="0x…"
                              dir="ltr"
                              className="h-8 w-44 font-mono text-xs"
                            />
                            <Button size="sm" onClick={() => sweep(d.id)} disabled={busy === d.id}>
                              {busy === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ArrowDownToLine className="h-3.5 w-3.5" />
                              )}
                              ثبت
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
