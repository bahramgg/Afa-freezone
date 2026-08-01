"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useSettlementsStore } from "@/lib/stores/settlements";
import { ApiClientError } from "@/lib/api/client";
import type { Settlement } from "@/lib/types";

/**
 * Asks for the account a payout should land in.
 *
 * A settlement raised from a paid invoice knows the amount and the currency,
 * but nobody has said where the rial should go — the invoice never collected a
 * bank account. Until this is filled the bank cannot lock a rate, so it sits at
 * the top of the merchant's settlement page rather than inside a dialog.
 */
export function PayoutAccountPrompt({ pending }: { pending: Settlement[] }) {
  const setPayoutAccount = useSettlementsStore((s) => s.setPayoutAccount);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function submit(ref: string) {
    if (account.trim().length < 4) {
      toast.error("شماره حساب یا شبا را کامل وارد کنید");
      return;
    }
    setBusy(ref);
    try {
      await setPayoutAccount(ref, account.trim());
      toast.success("شماره حساب ثبت شد — بانک نرخ را اعلام می‌کند");
      setAccount("");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "ثبت شماره حساب انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {pending.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-info/15 text-info">
              <Banknote className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-medium">
                تسویه {s.id} در انتظار شماره حساب شماست
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                این درخواست از فاکتور پرداخت‌شدهٔ شما ساخته شده و کریپتوی آن نزد بانک است.
                شماره حسابی که می‌خواهید ریال به آن واریز شود را وارد کنید.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`payout-${s.id}`}>شماره شبا یا حساب</Label>
              <Input
                id={`payout-${s.id}`}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="IR84-0170-0000-0011-2233-44"
                dir="ltr"
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={() => submit(s.id)} disabled={busy === s.id}>
              {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ثبت شماره حساب
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
