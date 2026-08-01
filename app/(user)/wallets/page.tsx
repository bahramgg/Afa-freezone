"use client";

import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Trash2, Wallet as WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/shared/CopyButton";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { WalletOwnershipDialog } from "@/components/wallet/WalletOwnershipDialog";
import { useWalletsStore } from "@/lib/stores/wallets";
import { truncateAddress } from "@/lib/format";

export default function WalletsPage() {
  const wallets = useWalletsStore((s) => s.list);
  const absorb = useWalletsStore((s) => s.absorb);
  const remove = useWalletsStore((s) => s.remove);

  async function handleRemove(id: string) {
    try {
      await remove(id);
      toast.success("والت حذف شد");
    } catch {
      toast.error("حذف والت انجام نشد");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت والت"
        description="افزودن و اثبات مالکیت والت‌های شخصی برای دریافت و ارسال کریپتو"
        actions={<WalletOwnershipDialog onVerified={absorb} />}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">آدرس</th>
                  <th className="text-start font-medium px-4 py-3">شبکه</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ تأیید</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <WalletIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      هنوز والتی اضافه نکرده‌اید
                    </td>
                  </tr>
                ) : (
                  wallets.map((w) => (
                    <tr key={w.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{w.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ltr className="font-mono text-xs">{truncateAddress(w.address)}</Ltr>
                          <CopyButton value={w.address} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{w.network}</td>
                      <td className="px-4 py-3">
                        {w.verified ? (
                          <Badge tone="success" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            مالکیت اثبات شده
                          </Badge>
                        ) : (
                          <Badge tone="warning" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            اثبات نشده
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.verifiedAt ? <JalaliDate iso={w.verifiedAt} /> : "—"}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(w.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        فقط والت‌هایی که <strong>مالکیتشان اثبات شده</strong> در فرم ایجاد فاکتور قابل انتخاب
        هستند. اثبات مالکیت با امضای یک متن توسط خودِ والت انجام می‌شود؛ کلید خصوصی شما هرگز وارد
        سامانه نمی‌شود.
      </p>
    </div>
  );
}
