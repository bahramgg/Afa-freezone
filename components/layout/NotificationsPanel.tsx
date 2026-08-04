"use client";

import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Undo2, Bell, CheckCircle2, FileText, XCircle, Wallet, Clock, Banknote, Mail, AlertCircle, Coins, Ban, RotateCcw } from "lucide-react";
import { useNotificationsStore } from "@/lib/stores/notifications";
import { useState } from "react";
import { useHydrated } from "@/lib/stores/hydration";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { NotificationKind } from "@/lib/types";

const ICONS: Record<NotificationKind, { icon: typeof Bell; tone: string }> = {
  KYC_APPROVED: { icon: CheckCircle2, tone: "text-success bg-success/10" },
  KYC_REJECTED: { icon: XCircle, tone: "text-destructive bg-destructive/10" },
  INVOICE_APPROVED: { icon: FileText, tone: "text-info bg-info/10" },
  INVOICE_REJECTED: { icon: XCircle, tone: "text-destructive bg-destructive/10" },
  PAYMENT_RECEIVED: { icon: Wallet, tone: "text-success bg-success/10" },
  INVOICE_EXPIRED: { icon: Clock, tone: "text-muted-foreground bg-muted" },
  SETTLEMENT_APPROVED: { icon: Banknote, tone: "text-info bg-info/10" },
  SETTLEMENT_SETTLED: { icon: CheckCircle2, tone: "text-success bg-success/10" },
  SETTLEMENT_REJECTED: { icon: XCircle, tone: "text-destructive bg-destructive/10" },
  FOREIGN_RECEIVE_REQUEST: { icon: Mail, tone: "text-primary bg-primary/10" },
  FOREIGN_CRYPTO_RECEIVED: { icon: Wallet, tone: "text-success bg-success/10" },
  SETTLEMENT_FROM_INVOICE: { icon: Banknote, tone: "text-info bg-info/10" },
  PAYMENT_PARTIAL: { icon: Clock, tone: "text-warning bg-warning/10" },
  INVOICE_ADDRESSED: { icon: FileText, tone: "text-primary bg-primary/10" },
  INVOICE_RATE_LOCKED: { icon: Coins, tone: "text-info bg-info/10" },
  INVOICE_RIAL_RECEIVED: { icon: Banknote, tone: "text-success bg-success/10" },
  INVOICE_CANCEL_REQUESTED: { icon: AlertCircle, tone: "text-warning bg-warning/10" },
  INVOICE_CANCELLED: { icon: Ban, tone: "text-destructive bg-destructive/10" },
  INVOICE_RIAL_RETURNED: { icon: RotateCcw, tone: "text-success bg-success/10" },
  REFUND_REQUESTED: { icon: Undo2, tone: "text-warning bg-warning/10" },
  REFUND_UPDATED: { icon: Undo2, tone: "text-info bg-info/10" },
};

export function NotificationsPanel() {
  const list = useNotificationsStore((s) => s.list);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const unreadCount = hydrated ? list.filter((n) => !n.read).length : 0;
  const filtered = filter === "unread" ? list.filter((n) => !n.read) : list;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="اعلان‌ها">
          <Bell className="h-5 w-5" />
          {hydrated && unreadCount > 0 ? (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            اعلان‌ها
          </SheetTitle>
        </SheetHeader>

        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="inline-flex h-9 items-center rounded-md bg-muted p-1 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded px-3 py-1 transition",
                filter === "all" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              همه
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded px-3 py-1 transition",
                filter === "unread" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              خوانده‌نشده
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            همه را خوانده‌شده علامت بزن
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">اعلانی برای نمایش وجود ندارد</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((n, i) => {
                const { icon: Icon, tone } = ICONS[n.kind];
                const Body = (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "flex gap-3 p-4 text-start cursor-pointer hover:bg-muted/40 transition-colors",
                      !n.read && "bg-primary/5",
                    )}
                    onClick={() => {
                      markRead(n.id);
                      if (n.href) setOpen(false);
                    }}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium">{n.title}</div>
                        {!n.read ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {hydrated ? fromNow(n.createdAt) : ""}
                      </p>
                    </div>
                  </motion.div>
                );
                return (
                  <li key={n.id}>
                    {n.href ? <Link href={n.href}>{Body}</Link> : Body}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
