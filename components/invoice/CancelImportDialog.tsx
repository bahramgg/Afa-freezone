"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Input";
import { ApiClientError } from "@/lib/api/client";

/**
 * Calling an import off, or asking for it to be called off.
 *
 * The same dialog serves both because they ask for the same thing — a reason —
 * and differ only in who is answering. A cancelled trade with no reason on it
 * is a file nobody can settle an argument with later, so the reason is required
 * rather than encouraged.
 */
export function CancelImportDialog({
  open,
  onOpenChange,
  mode,
  invoiceRef,
  /** Whether the importer's rial is already at the bank. Changes what happens next. */
  rialHeld,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "request" | "cancel";
  invoiceRef: string;
  rialHeld: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const asking = mode === "request";

  async function submit() {
    const text = reason.trim();
    if (text.length < 3) {
      toast.error("دلیل را بنویسید");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(text);
      toast.success(asking ? "درخواست لغو ثبت شد" : "فاکتور لغو شد");
      setReason("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{asking ? "درخواست لغو فاکتور" : "لغو فاکتور"}</DialogTitle>
          <DialogDescription>
            فاکتور {invoiceRef}
            {asking
              ? " — درخواست شما برای سازمان و بانک ثبت می‌شود. تصمیم نهایی با آن‌هاست، چون ریال نزد بانک است و جابه‌جایی ارز بیرون از سامانه انجام می‌شود."
              : rialHeld
                ? " — ریال واردکننده نزد بانک است. با لغو، فاکتور در وضعیت «در انتظار بازگشت ریال» می‌ماند تا بانک بازگشت را ثبت کند."
                : " — هنوز ریالی واریز نشده، پس فاکتور همین‌جا بسته می‌شود."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">دلیل</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً فروشنده بار را ارسال نکرد"
          />
          <p className="text-xs text-muted-foreground">
            این متن در تاریخچهٔ فاکتور می‌ماند و برای هر دو طرف نمایش داده می‌شود.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            انصراف
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {asking ? "ثبت درخواست" : "لغو فاکتور"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
