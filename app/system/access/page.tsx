"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";

type Role = "IRANIAN" | "FOREIGN" | "ADMIN" | "BANK" | "SUPERADMIN";

type Entry = {
  id: string;
  email: string;
  role: Role;
  roleLabel: string;
  staff: boolean;
  note?: string;
  addedByUid?: string;
  createdAt: string;
  accountUid?: string;
  accountRole?: Role;
  accountDisabled?: boolean;
};

/** The roles an entry can be added as, in the order they are usually needed. */
const ROLES: Array<{ value: Role; label: string; hint: string }> = [
  { value: "ADMIN", label: "سازمان منطقه آزاد", hint: "بررسی و تأیید فاکتورها، احراز هویت، تنظیمات" },
  { value: "BANK", label: "بانک عامل", hint: "تأمین ارز، قفل نرخ، تسویه" },
  { value: "SUPERADMIN", label: "مدیر سیستم", hint: "همین صفحه، کاربران و گزارش رویدادها" },
  { value: "IRANIAN", label: "بازرگان ایرانی", hint: "فقط وقتی ثبت‌نام محدود باشد" },
  { value: "FOREIGN", label: "بازرگان خارجی", hint: "فقط وقتی ثبت‌نام محدود باشد" },
];

const TONE: Partial<Record<Role, "info" | "success" | "warning">> = {
  ADMIN: "info",
  BANK: "success",
  SUPERADMIN: "warning",
};

/**
 * Who may sign in, and as what.
 *
 * Two lists on one page, because they answer the same question for two
 * populations and keeping them apart would let the answers drift.
 */
export default function SystemAccessPage() {
  const [restricted, setRestricted] = useState(false);
  const [list, setList] = useState<Entry[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get<{ restricted: boolean; list: Entry[] }>("/system/access");
    setRestricted(data.restricted);
    setList(data.list);
  }, []);
  useLoad(load);

  const staff = useMemo(() => list.filter((e) => e.staff), [list]);
  const merchants = useMemo(() => list.filter((e) => !e.staff), [list]);

  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await api.post("/system/access", body);
      await load();
      toast.success(done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="دسترسی‌ها"
        description="تعیین اینکه چه نشانی‌هایی وارد می‌شوند و با چه نقشی"
      />

      <form
        className="grid gap-3 rounded-lg border border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            { action: "add", email, role, note: note || undefined },
            "نشانی به فهرست اضافه شد",
          ).then(() => {
            setEmail("");
            setNote("");
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs text-slate-400">
            نشانی ایمیل
          </Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            placeholder="operator@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role" className="text-xs text-slate-400">
            نقش
          </Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value} className="bg-slate-900">
                {r.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-5 text-slate-500">
            {ROLES.find((r) => r.value === role)?.hint}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note" className="text-xs text-slate-400">
            یادداشت (اختیاری)
          </Label>
          <Input
            id="note"
            placeholder="مثلاً کارشناس ارزی بانک"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
          />
        </div>
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          افزودن
        </Button>
      </form>

      {/* ─────────────────────────────────────────────── operators ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">اپراتورها — بانک، سازمان و مدیر سیستم</h2>
        </div>
        <p className="max-w-3xl text-xs leading-6 text-slate-400">
          فقط همین نشانی‌ها می‌توانند وارد پنل بانک یا سازمان شوند. این فهرست همیشه اعمال می‌شود —
          مستقل از اینکه ثبت‌نام بازرگانان باز باشد یا بسته. حذف یک نشانی، نشست‌های باز آن را همان
          لحظه قطع می‌کند و پنل را از دستش می‌گیرد.
        </p>
        <AccessTable
          rows={staff}
          busy={busy}
          empty="هیچ اپراتوری تعریف نشده — هیچ‌کس نمی‌تواند وارد پنل بانک یا سازمان شود"
          onRole={(entry, next) =>
            run({ action: "setRole", email: entry.email, role: next }, "نقش تغییر کرد")
          }
          onRemove={(entry) =>
            run({ action: "remove", email: entry.email }, "دسترسی حذف شد")
          }
        />
      </section>

      {/* ─────────────────────────────────────────────── merchants ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">بازرگانان</h2>
        <div className="rounded-lg border border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {restricted ? "ثبت‌نام محدود است" : "ثبت‌نام برای همه باز است"}
              </div>
              <p className="max-w-lg text-xs leading-6 text-slate-400">
                {restricted
                  ? "فقط نشانی‌های فهرست پایین می‌توانند حساب بازرگانی بسازند. بقیه هنگام درخواست کد ورود رد می‌شوند."
                  : "هر نشانی ایمیلی می‌تواند حساب بازرگانی بسازد. فهرست پایین نگهداری می‌شود ولی اعمال نمی‌شود — هر وقت خواستید با همین کلید فعالش کنید. روی اپراتورها اثری ندارد."}
              </p>
            </div>
            <Button
              variant={restricted ? "outline" : "default"}
              disabled={busy}
              onClick={() =>
                run(
                  { action: "setRestricted", restricted: !restricted },
                  !restricted ? "ثبت‌نام محدود شد" : "ثبت‌نام برای همه باز شد",
                )
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {restricted ? "باز کردن برای همه" : "محدود کردن به فهرست"}
            </Button>
          </div>
        </div>
        <AccessTable
          rows={merchants}
          busy={busy}
          empty="فهرست خالی است — تا وقتی ثبت‌نام باز است اثری ندارد"
          onRole={(entry, next) =>
            run({ action: "setRole", email: entry.email, role: next }, "نقش تغییر کرد")
          }
          onRemove={(entry) => run({ action: "remove", email: entry.email }, "از فهرست حذف شد")}
        />
      </section>
    </div>
  );
}

function AccessTable({
  rows,
  busy,
  empty,
  onRole,
  onRemove,
}: {
  rows: Entry[];
  busy: boolean;
  empty: string;
  onRole: (entry: Entry, role: Role) => void;
  onRemove: (entry: Entry) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-6">
        <EmptyState title="چیزی اینجا نیست" description={empty} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-white/5">
            <tr className="text-xs text-slate-400">
              <th className="text-start font-medium px-4 py-3">ایمیل</th>
              <th className="text-start font-medium px-4 py-3">نقش</th>
              <th className="text-start font-medium px-4 py-3">حساب</th>
              <th className="text-start font-medium px-4 py-3">یادداشت</th>
              <th className="text-start font-medium px-4 py-3">افزوده توسط</th>
              <th className="text-start font-medium px-4 py-3">تاریخ</th>
              <th className="text-start font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <Ltr className="font-mono text-xs">{e.email}</Ltr>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={e.role}
                    disabled={busy}
                    onChange={(event) => onRole(e, event.target.value as Role)}
                    className="h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="bg-slate-900">
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {/* An entry with no account behind it has been added but never
                      used — worth showing, because it looks identical to a
                      working operator until someone tries to sign in. */}
                  {e.accountUid ? (
                    <div className="space-y-1">
                      <Ltr className="block font-mono text-xs text-slate-300">{e.accountUid}</Ltr>
                      {e.accountDisabled ? <Badge tone="destructive">غیرفعال</Badge> : null}
                      {e.accountRole && e.accountRole !== e.role ? (
                        <Badge tone={TONE[e.role] ?? "info"}>در ورود بعدی اعمال می‌شود</Badge>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">هنوز وارد نشده</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{e.note ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {e.addedByUid ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  <JalaliDate iso={e.createdAt} />
                </td>
                <td className="px-4 py-3 text-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => onRemove(e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
