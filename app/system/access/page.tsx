"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { EmptyState } from "@/components/shared/EmptyState";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";

type Entry = {
  id: string;
  email: string;
  note?: string;
  addedByUid?: string;
  createdAt: string;
};

/**
 * Who may register.
 *
 * The list can be built while the gateway is still open to everyone, so closing
 * it later is one switch rather than a scramble to fill it on the day.
 */
export default function SystemAccessPage() {
  const [restricted, setRestricted] = useState(false);
  const [list, setList] = useState<Entry[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get<{ restricted: boolean; list: Entry[] }>("/system/access");
    setRestricted(data.restricted);
    setList(data.list);
  }, []);
  useLoad(load);

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
        title="دسترسی ثبت‌نام"
        description="تعیین اینکه چه نشانی‌هایی اجازهٔ ساخت حساب دارند"
      />

      <div className="rounded-lg border border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {restricted ? "ثبت‌نام محدود است" : "ثبت‌نام برای همه باز است"}
            </div>
            <p className="max-w-lg text-xs leading-6 text-slate-400">
              {restricted
                ? "فقط نشانی‌های فهرست زیر می‌توانند حساب بسازند. بقیه هنگام درخواست کد ورود رد می‌شوند."
                : "هر نشانی ایمیلی می‌تواند حساب بسازد. فهرست زیر نگهداری می‌شود ولی اعمال نمی‌شود — هر وقت خواستید با همین کلید فعالش کنید."}
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

      <form
        className="grid gap-3 rounded-lg border border-white/10 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ action: "add", email, note: note || undefined }, "نشانی به فهرست اضافه شد").then(
            () => {
              setEmail("");
              setNote("");
            },
          );
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
            placeholder="partner@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note" className="text-xs text-slate-400">
            یادداشت (اختیاری)
          </Label>
          <Input
            id="note"
            placeholder="مثلاً شرکت نینگبو"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500"
          />
        </div>
        <Button type="submit" disabled={busy || !email.trim()}>
          <Plus className="h-4 w-4" />
          افزودن
        </Button>
      </form>

      <div className="rounded-lg border border-white/10">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="فهرست خالی است"
              description="تا وقتی ثبت‌نام باز است این فهرست اثری ندارد"
            />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-white/5">
                <tr className="text-xs text-slate-400">
                  <th className="text-start font-medium px-4 py-3">ایمیل</th>
                  <th className="text-start font-medium px-4 py-3">یادداشت</th>
                  <th className="text-start font-medium px-4 py-3">افزوده توسط</th>
                  <th className="text-start font-medium px-4 py-3">تاریخ</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <Ltr className="font-mono text-xs">{e.email}</Ltr>
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
                        onClick={() => run({ action: "remove", email: e.email }, "از فهرست حذف شد")}
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
        )}
      </div>
    </div>
  );
}
