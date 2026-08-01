"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

/**
 * Downloads a report as a real .xlsx workbook.
 *
 * The file is built on the server from the database, so it carries every row
 * the session may see rather than the page the client happens to be holding,
 * and the scope cannot be widened from here.
 */

export type ExportDataset =
  | "invoices"
  | "sends"
  | "settlements"
  | "transactions"
  | "ledger"
  | "users";

const LABELS: Record<ExportDataset, string> = {
  invoices: "فاکتورها",
  sends: "درخواست‌های ارسال",
  settlements: "درخواست‌های تسویه",
  transactions: "تراکنش‌های زنجیره",
  ledger: "دفتر کل",
  users: "کاربران",
};

async function download(dataset: ExportDataset) {
  const res = await fetch(`/api/reports/export?dataset=${dataset}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    // The error path returns the usual JSON envelope, not a workbook.
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "خروجی گرفتن انجام نشد");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `afa-${dataset}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportExcelButton({ datasets }: { datasets: ExportDataset[] }) {
  const [busy, setBusy] = useState(false);

  async function run(dataset: ExportDataset) {
    setBusy(true);
    try {
      await download(dataset);
      toast.success("فایل اکسل دانلود شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خروجی گرفتن انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const icon = busy ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Download className="h-4 w-4" />
  );

  // A single dataset needs no menu to choose from.
  if (datasets.length === 1) {
    return (
      <Button variant="outline" onClick={() => run(datasets[0])} disabled={busy}>
        {icon}
        خروجی اکسل
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {icon}
          خروجی اکسل
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {datasets.map((dataset) => (
          <DropdownMenuItem key={dataset} onSelect={() => run(dataset)}>
            {LABELS[dataset]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
