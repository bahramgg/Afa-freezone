"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ExternalLink, Share2, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CopyButton } from "@/components/shared/CopyButton";
import { MoneyText } from "@/components/shared/MoneyText";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { useSendStore } from "@/lib/stores/send";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { bscScanUrl, formatAmount, truncateAddress } from "@/lib/format";

export default function ForeignPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const item = useSendStore((s) => s.list.find((r) => r.id === id));
  const user = useForeignStore((s) => s.user);

  useEffect(() => {
    if (hydrated && !item) router.replace("/foreign/requests");
  }, [hydrated, item, router]);

  if (!hydrated || !item) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isMine = item.counterpartyUid === user?.uid;
  if (!isMine) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        این درخواست متعلق به حساب شما نیست.
      </div>
    );
  }

  const walletAddress = item.recipientWalletAddress ?? "";

  async function share() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/foreign/requests/${id}/payment` : "";
    const title = `صفحه پرداخت ${item?.trxId ?? ""}`;
    const text = `${formatAmount(item?.amount ?? 0)} ${item?.currency} — والت دریافت: ${walletAddress}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("لینک صفحه پرداخت کپی شد", { description: url });
    } catch {
      toast.error("اشتراک‌گذاری انجام نشد");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/foreign/requests">
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Link>
        </Button>
        <Badge tone="success">صفحه پرداخت فعال</Badge>
      </div>

      <PageHeader
        title={`صفحه پرداخت ${item.trxId}`}
        description="این صفحه را با کاربر ایرانی به اشتراک بگذارید — اطلاعات والت شما در آن نمایش داده می‌شود"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              والت دریافت شما
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="rounded-lg border border-border bg-white p-3">
                <QRCodeSVG
                  value={walletAddress ? `bsc:${walletAddress}?amount=${item.amount}&currency=${item.currency}` : ""}
                  size={180}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground">QR والت دریافت — کاربر ایرانی می‌تواند آن را اسکن کند</p>
            </motion.div>

            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-xs text-muted-foreground">آدرس والت دریافت (BSC)</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs break-all" dir="ltr">{walletAddress}</span>
                <CopyButton value={walletAddress} label="کپی آدرس" />
              </div>
              {walletAddress ? (
                <a
                  href={bscScanUrl(walletAddress, "address")}
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                  dir="ltr"
                >
                  مشاهده در BscScan
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={share}>
              <Share2 className="h-4 w-4" />
              اشتراک‌گذاری با کاربر ایرانی
            </Button>

            <div className="rounded-md bg-info/10 border border-info/30 p-3 text-xs leading-6">
              پس از اشتراک‌گذاری، روند تأیید توسط ادمین و بانک به‌صورت خودکار انجام می‌شود. وقتی کریپتو در والت شما واریز شود، اعلان دریافت خواهید کرد.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>اطلاعات درخواست</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="شماره TRX" value={item.trxId} />
            <Row label="فرستنده" value={item.userName ?? item.userUid ?? "—"} />
            <Row label="مبلغ" value={<MoneyText amount={item.amount} currency={item.currency} />} />
            <Row label="ارز" value={<Badge tone="primary">{item.currency}</Badge>} />
            <Row label="تاریخ درخواست" value={<JalaliDate iso={item.createdAt} withTime />} />
            {item.description ? (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">توضیحات</div>
                <p className="text-xs leading-6">{item.description}</p>
              </div>
            ) : null}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1">والت دریافت</div>
              <div className="font-mono text-xs" dir="ltr">{walletAddress ? truncateAddress(walletAddress, 10, 8) : "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
