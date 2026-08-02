"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { Bell, ChevronDown, LogOut, ShieldCheck, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { useForeignStore } from "@/lib/stores/foreign";
import { useHydrated } from "@/lib/stores/hydration";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ForeignMobileNav } from "./ForeignMobileNav";

export function ForeignHeader() {
  const user = useForeignStore((s) => s.user);
  const notifications = useForeignStore((s) => s.notifications);
  const markRead = useForeignStore((s) => s.markRead);
  const markAllRead = useForeignStore((s) => s.markAllRead);
  const logout = useForeignStore((s) => s.logout);
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unread = hydrated ? notifications.filter((n) => !n.read).length : 0;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const initials = user?.fullName
    ? user.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")
    : "?";

  return (
    <header className="sticky top-0 z-30 glass border-b border-border">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <ForeignMobileNav />
          {hydrated && user ? (
            <Badge tone="success" className="gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              KYC Verified
            </Badge>
          ) : null}
          {hydrated && user ? (
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono">{user.uid}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="اعلان‌ها">
                <Bell className="h-5 w-5" />
                {hydrated && unread > 0 ? (
                  <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {unread}
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
                  همه را خوانده شدند
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
                    {filtered.map((n, i) => (
                      <li key={n.id}>
                        <Link
                          href={n.href ?? "#"}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                        >
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className={cn(
                              "flex gap-3 p-4 text-start cursor-pointer hover:bg-muted/40 transition-colors",
                              !n.read && "bg-primary/5",
                            )}
                          >
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
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    style={{ background: user?.avatarColor }}
                    className="text-white"
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-end hidden sm:block">
                  <div className="text-xs font-medium leading-tight">
                    {hydrated && user ? user.fullName : "..."}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {hydrated && user ? user.country : ""}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Foreign Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/foreign/settings">تنظیمات</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  router.replace("/");
                }}
                className="text-destructive"
              >
                <LogOut className="h-4 w-4" />
                خروج از پنل
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
