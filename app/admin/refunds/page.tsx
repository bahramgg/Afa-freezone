"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Undo2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { MoneyText } from "@/components/shared/MoneyText";
import { Ltr } from "@/components/shared/Ltr";
import { CopyButton } from "@/components/shared/CopyButton";
import { api, ApiClientError } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { truncateAddress, truncateHash } from "@/lib/format";
import type { Refund } from "@/lib/types";

/**
 * Refunds waiting on a decision.
 *
 * The destination is not editable here and never was: it is the address the
 * buyer paid from, read off the chain when the refund was raised. Admin decides
 * whether the money goes back; the bank moves it and proves it.
 */

const STATUS: Record<string, { label: string; tone: "info" | "success" | "warning" | "destructive" }> = {
  REQUESTED: { label: "در انتظار تأیید ادمین", tone: "warning" },
  APPROVED: { label: "در انتظار انتقال بانک", tone: "info" },
  SENT: { label: "بازگردانده شد", tone: "success" },
  REJECTED: { label: "رد شد", tone: "destructive" },
};

export default function RefundsPage() {
  const [list, setList] = useState<Refund[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ list: Refund[] }>("/refunds");
    setList(data.list);
  }, []);
  useLoad(load);

  async function act(ref: string, action: "approve" | "reject") {
    if (action === "reject" && !(reason[ref] ?? "").trim()) {
      toast.error("دلیل رد را وارد کنید");
      return;
    }
    setBusy(ref);
    try {
      await api.patch("/refunds", { ref, action, reason: reason[ref] });
      toast.success(action === "approve" ? "بازگشت وجه تأیید شد" : "درخواست رد شد");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="بازگشت وجه"
        description="درخواست‌های بازگشت وجه به خریدار — مقصد همان آدرسی است که پرداخت از آن آمده"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">شماره</th>
                  <th className="text-start font-medium px-4 py-3">فاکتور</th>
                  <th className="text-start font-medium px-4 py-3">تاجر</th>
                  <th className="text-start font-medium px-4 py-3">مبلغ</th>
                  <th className="text-start font-medium px-4 py-3">مقصد</th>
                  <th className="text-start font-medium px-4 py-3">دلیل</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Undo2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      درخواست بازگشت وجهی ثبت نشده است
                    </td>
                  </tr>
                ) : (
                  list.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.invoiceRef}</td>
                      <td className="px-4 py-3 text-xs">
                        {r.merchantName}
                        <div className="text-muted-foreground">{r.merchantUid}</div>
                      </td>
                      <td className="px-4 py-3">
                        <MoneyText amount={r.amount} currency={r.currency} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Ltr className="font-mono text-xs">{truncateAddress(r.toAddress)}</Ltr>
                          <CopyButton value={r.toAddress} />
                        </div>
                        {r.txHash ? (
                          <Ltr className="block font-mono text-[10px] text-muted-foreground">
                            {truncateHash(r.txHash)}
                          </Ltr>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 text-xs">
                        {r.reason}
                        {r.rejectReason ? (
                          <div className="mt-1 text-destructive">{r.rejectReason}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS[r.status]?.tone ?? "info"}>
                          {STATUS[r.status]?.label ?? r.status}
                        </Badge>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          <JalaliDate iso={r.createdAt} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "REQUESTED" ? (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              onClick={() => act(r.id, "approve")}
                              disabled={busy === r.id}
                            >
                              {busy === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              تأیید
                            </Button>
                            <div className="flex gap-1">
                              <Input
                                value={reason[r.id] ?? ""}
                                onChange={(e) =>
                                  setReason((x) => ({ ...x, [r.id]: e.target.value }))
                                }
                                placeholder="دلیل رد"
                                className="h-8 w-32 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => act(r.id, "reject")}
                                disabled={busy === r.id}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
