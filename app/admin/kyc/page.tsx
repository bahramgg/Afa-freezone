"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Ltr } from "@/components/shared/Ltr";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useKycStore } from "@/lib/stores/kyc";
import { toast } from "sonner";
import type { KycRequest } from "@/lib/stores/kyc";

export default function AdminKycPage() {
  const requests = useKycStore((s) => s.requests);
  const approveRequest = useKycStore((s) => s.approveRequest);
  const rejectRequest = useKycStore((s) => s.rejectRequest);

  const [rejectTarget, setRejectTarget] = useState<KycRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  function handleApprove(uid: string, name: string) {
    approveRequest(uid);
    toast.success(`احراز هویت ${name} تأیید شد`);
  }

  function openRejectDialog(req: KycRequest) {
    setRejectTarget(req);
    setRejectNote("");
  }

  function confirmReject() {
    if (!rejectTarget) return;
    rejectRequest(rejectTarget.uid, rejectNote || undefined);
    toast.error(`احراز هویت ${rejectTarget.fullName} رد شد`);
    setRejectTarget(null);
  }

  const statusBadge = (status: KycRequest["status"]) => {
    if (status === "APPROVED") return <Badge tone="success">تأیید شده</Badge>;
    if (status === "REJECTED") return <Badge tone="destructive">رد شده</Badge>;
    return <Badge tone="warning">در انتظار بررسی</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="احراز هویت کاربران"
        description="درخواست‌های احراز هویت ارسال‌شده توسط کاربران"
      />

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            هیچ درخواست احراز هویتی ثبت نشده است
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-start font-medium px-4 py-3">UID</th>
                    <th className="text-start font-medium px-4 py-3">نام</th>
                    <th className="text-start font-medium px-4 py-3">کد ملی</th>
                    <th className="text-start font-medium px-4 py-3">شناسه کاربری منطقه آزاد</th>
                    <th className="text-start font-medium px-4 py-3">شماره موبایل</th>
                    <th className="text-start font-medium px-4 py-3">تاریخ ثبت</th>
                    <th className="text-start font-medium px-4 py-3">وضعیت</th>
                    <th className="text-start font-medium px-4 py-3">اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.uid} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{req.uid}</td>
                      <td className="px-4 py-3 font-medium">{req.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{req.nationalId}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{req.freezoneId}</td>
                      <td className="px-4 py-3 text-muted-foreground"><Ltr>{req.phone}</Ltr></td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <JalaliDate iso={req.submittedAt} />
                      </td>
                      <td className="px-4 py-3">{statusBadge(req.status)}</td>
                      <td className="px-4 py-3">
                        {req.status === "PENDING" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-success hover:text-success hover:bg-success/10 gap-1.5"
                              onClick={() => handleApprove(req.uid, req.fullName)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              تأیید
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                              onClick={() => openRejectDialog(req)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              رد
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {req.reviewedAt ? <JalaliDate iso={req.reviewedAt} /> : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رد درخواست احراز هویت</DialogTitle>
            <DialogDescription>
              درخواست احراز هویت <span className="font-medium text-foreground">{rejectTarget?.fullName}</span> رد خواهد شد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectNote">دلیل رد (اختیاری)</Label>
            <Input
              id="rejectNote"
              placeholder="مثلاً: اطلاعات ناقص یا نادرست"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              تأیید رد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
