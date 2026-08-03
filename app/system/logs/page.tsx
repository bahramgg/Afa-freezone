"use client";

import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits } from "@/lib/format";

type LogRow = {
  id: string;
  source: "AUDIT" | "FLOW";
  action: string;
  subject?: string;
  detail?: string;
  actorUid?: string;
  actorName?: string;
  actorRole?: string;
  ip?: string;
  createdAt: string;
};

const ACTION_FA: Record<string, string> = {
  LOGIN_CODE_SENT: "ارسال کد ورود",
  LOGIN_SUCCEEDED: "ورود با کد",
  LOGIN_VIA_LINK: "ورود با پیوند",
  LOGOUT: "خروج",
  REGISTERED: "ثبت‌نام",
  USER_DISABLED: "غیرفعال کردن حساب",
  USER_ENABLED: "فعال‌سازی حساب",
  USER_ROLE_CHANGED: "تغییر نقش",
  ALLOWLIST_ADDED: "افزودن به فهرست مجاز",
  ALLOWLIST_REMOVED: "حذف از فهرست مجاز",
  REGISTRATION_POLICY_CHANGED: "تغییر سیاست ثبت‌نام",
};

const SOURCES = [
  { key: "ALL", label: "همه" },
  { key: "AUDIT", label: "رویدادهای حساب" },
  { key: "FLOW", label: "گردش تراکنش‌ها" },
] as const;

/**
 * Both halves of the record in one list.
 *
 * Who signed in and who was disabled sit beside every step every trade took,
 * because when something has gone wrong nobody knows in advance which of the
 * two they are looking for.
 */
export default function SystemLogsPage() {
  const [list, setList] = useState<LogRow[]>([]);
  const [source, setSource] = useState<(typeof SOURCES)[number]["key"]>("ALL");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const data = await api.get<{ list: LogRow[] }>(
      `/system/logs?source=${source}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    );
    setList(data.list);
  }, [source, search]);
  useLoad(load, [source]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارش رویدادها"
        description="ورود و خروج، تغییر حساب‌ها، و هر قدمی که تراکنش‌ها برداشته‌اند"
      />

      <div className="flex flex-wrap items-center gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSource(s.key)}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              source === s.key ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {s.label}
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
            placeholder="ایمیل، شناسه، مرجع…"
            className="h-8 w-52 border-white/15 bg-white/5 text-xs text-white placeholder:text-slate-500"
          />
          <Button type="submit" size="sm" variant="ghost" className="text-slate-300">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-white/10">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState title="رویدادی ثبت نشده است" />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-white/5">
                <tr className="text-xs text-slate-400">
                  <th className="text-start font-medium px-4 py-3">زمان</th>
                  <th className="text-start font-medium px-4 py-3">رویداد</th>
                  <th className="text-start font-medium px-4 py-3">موضوع</th>
                  <th className="text-start font-medium px-4 py-3">توضیح</th>
                  <th className="text-start font-medium px-4 py-3">عامل</th>
                  <th className="text-start font-medium px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={`${e.source}-${e.id}`} className="border-t border-white/10 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      <JalaliDate iso={e.createdAt} withTime />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={e.source === "AUDIT" ? "info" : "neutral"} className="text-[10px]">
                          {e.source === "AUDIT" ? "حساب" : "گردش"}
                        </Badge>
                        <span className="text-xs">{ACTION_FA[e.action] ?? e.action}</span>
                      </div>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3">
                      <Ltr className="font-mono text-xs text-slate-300">{e.subject ?? "—"}</Ltr>
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-xs text-slate-400">
                      {e.detail ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.actorUid ? (
                        <span>
                          {e.actorName || e.actorUid}
                          <span className="ms-1 font-mono text-[10px] text-slate-500">{e.actorUid}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">سیستم</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Ltr className="font-mono text-[11px] text-slate-500">{e.ip ?? "—"}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {toPersianDigits(list.length)} رویداد نمایش داده شده است.
      </p>
    </div>
  );
}
