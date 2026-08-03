"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { EmptyState } from "@/components/shared/EmptyState";
import { Ltr } from "@/components/shared/Ltr";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits } from "@/lib/format";

type SystemUser = {
  uid: string;
  fullName: string;
  email?: string;
  role: string;
  kyc: string;
  disabled: boolean;
  disabledAt?: string;
  sessionCount: number;
  invoiceCount: number;
  joinedAt: string;
};

const ROLE_FA: Record<string, string> = {
  IRANIAN: "بازرگان داخلی",
  FOREIGN: "بازرگان خارجی",
  ADMIN: "کارشناس سازمان",
  BANK: "بانک عامل",
  SUPERADMIN: "مدیر سیستم",
};

const FILTERS = ["ALL", "IRANIAN", "FOREIGN", "ADMIN", "BANK", "SUPERADMIN"] as const;

/**
 * Every account, and the one lever that matters: whether it still works.
 *
 * Disabling revokes the sessions as well as setting the flag — a ban that lets
 * someone carry on until their cookie expires is not a ban.
 */
export default function SystemUsersPage() {
  const [list, setList] = useState<SystemUser[]>([]);
  const [role, setRole] = useState<(typeof FILTERS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ list: SystemUser[] }>(
      `/system/users?role=${role}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    );
    setList(data.list);
  }, [role, search]);
  useLoad(load, [role]);

  async function act(uid: string, action: "disable" | "enable") {
    setBusy(uid);
    try {
      await api.patch("/system/users", { uid, action });
      await load();
      toast.success(action === "disable" ? "حساب غیرفعال شد" : "حساب دوباره فعال شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="کاربران"
        description="تمام حساب‌های سامانه، شامل کارکنان — غیرفعال کردن، نشست‌ها را هم قطع می‌کند"
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setRole(f)}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              role === f ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {f === "ALL" ? "همه" : ROLE_FA[f]}
          </button>
        ))}
        <form
          className="ms-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو…"
            className="h-8 w-44 border-white/15 bg-white/5 text-xs text-white placeholder:text-slate-500"
          />
          <Button type="submit" size="sm" variant="ghost" className="text-slate-300">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-white/10">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState title="کاربری یافت نشد" />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-white/5">
                <tr className="text-xs text-slate-400">
                  <th className="text-start font-medium px-4 py-3">شناسه</th>
                  <th className="text-start font-medium px-4 py-3">نام</th>
                  <th className="text-start font-medium px-4 py-3">ایمیل</th>
                  <th className="text-start font-medium px-4 py-3">نقش</th>
                  <th className="text-start font-medium px-4 py-3">نشست</th>
                  <th className="text-start font-medium px-4 py-3">عضویت</th>
                  <th className="text-start font-medium px-4 py-3">وضعیت</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.uid} className="border-t border-white/10">
                    <td className="px-4 py-3 font-mono text-xs">{u.uid}</td>
                    <td className="px-4 py-3">{u.fullName || "—"}</td>
                    <td className="px-4 py-3">
                      <Ltr className="font-mono text-xs text-slate-300">{u.email ?? "—"}</Ltr>
                    </td>
                    <td className="px-4 py-3 text-xs">{ROLE_FA[u.role] ?? u.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {toPersianDigits(u.sessionCount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <JalaliDate iso={u.joinedAt} />
                    </td>
                    <td className="px-4 py-3">
                      {u.disabled ? (
                        <Badge tone="destructive" className="gap-1">
                          <Ban className="h-3 w-3" />
                          غیرفعال
                        </Badge>
                      ) : (
                        <Badge tone="success" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          فعال
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        size="sm"
                        variant={u.disabled ? "outline" : "ghost"}
                        disabled={busy === u.uid}
                        className={u.disabled ? "" : "text-destructive hover:text-destructive"}
                        onClick={() => act(u.uid, u.disabled ? "enable" : "disable")}
                      >
                        {busy === u.uid ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : u.disabled ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                        {u.disabled ? "فعال‌سازی" : "غیرفعال کردن"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
