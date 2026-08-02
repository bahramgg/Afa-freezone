"use client";

import { useCallback, useState } from "react";
import { Banknote, Landmark, PiggyBank, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/shared/StatCard";
import { JalaliDate } from "@/components/shared/JalaliDate";
import { Ltr } from "@/components/shared/Ltr";
import { ExportExcelButton } from "@/components/shared/ExportExcelButton";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/stores/useLoad";
import { toPersianDigits, formatAmount } from "@/lib/format";

/**
 * Where the money is, and whose it is.
 *
 * The bank's wallets hold one pile of tokens with several owners. This is the
 * only screen that separates them: what is still owed to merchants, what the
 * gateway has earned, what the organization's share of that is, and what the
 * bank made on the exchange.
 */

type Balance = { account: string; unit: string; amount: string };
type Entry = {
  id: string;
  account: string;
  amount: string;
  unit: string;
  kind: string;
  subjectRef?: string;
  userUid?: string;
  userName?: string;
  note?: string;
  createdAt: string;
};

const ACCOUNT_FA: Record<string, string> = {
  DEPOSIT_HELD: "نزد آدرس‌های واریز",
  BANK_HELD: "نزد خزانه بانک",
  MERCHANT_PAYABLE: "بدهی به تاجران",
  GATEWAY_SHARE: "سهم درگاه",
  FREEZONE_SHARE: "سهم سازمان منطقه آزاد",
  BANK_SPREAD: "حاشیه صرافی بانک",
  GATEWAY_PAID: "کارمزد دریافتی درگاه",
  FREEZONE_PAID: "سهم پرداخت‌شده به سازمان",
  SUPPLIER_PAID: "پرداخت به فروشندگان خارجی",
  REFUNDED: "بازگردانده به خریدار",
};

const KIND_FA: Record<string, string> = {
  INVOICE_PAID: "پرداخت فاکتور",
  DEPOSIT_RELEASED: "تقسیم واریزی روی زنجیره",
  DEPOSIT_SWEPT: "برداشت به خزانه",
  REFUND_SENT: "بازگرداندن وجه به خریدار",
  SETTLEMENT_FUNDED: "دریافت کریپتو برای تسویه",
  SETTLEMENT_SETTLED: "پرداخت ریال به تاجر",
};

const ICONS: Record<string, typeof Wallet> = {
  DEPOSIT_HELD: Wallet,
  BANK_HELD: Landmark,
  MERCHANT_PAYABLE: Users,
  GATEWAY_SHARE: PiggyBank,
  FREEZONE_SHARE: Banknote,
  BANK_SPREAD: Banknote,
  GATEWAY_PAID: PiggyBank,
  FREEZONE_PAID: Banknote,
  SUPPLIER_PAID: Users,
  REFUNDED: Wallet,
};

const ORDER = [
  "DEPOSIT_HELD",
  "BANK_HELD",
  "MERCHANT_PAYABLE",
  "GATEWAY_SHARE",
  "FREEZONE_SHARE",
  "GATEWAY_PAID",
  "FREEZONE_PAID",
  "SUPPLIER_PAID",
  "REFUNDED",
  "BANK_SPREAD",
];

export default function LedgerPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    const data = await api.get<{ balances: Balance[]; entries: Entry[] }>("/ledger");
    setBalances(data.balances);
    setEntries(data.entries);
  }, []);
  useLoad(load);

  const sorted = [...balances].sort(
    (a, b) => ORDER.indexOf(a.account) - ORDER.indexOf(b.account),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="دفتر کل"
        description="موقعیت مالی درگاه — بدهی به تاجران، کارمزد، و سهم هر طرف"
        actions={<ExportExcelButton datasets={["ledger"]} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((b) => {
          const Icon = ICONS[b.account] ?? Wallet;
          return (
            <StatCard
              key={`${b.account}-${b.unit}`}
              icon={Icon}
              label={ACCOUNT_FA[b.account] ?? b.account}
              value={`${toPersianDigits(formatAmount(Number(b.amount)))} ${b.unit === "IRR" ? "ریال" : b.unit}`}
              tone={b.account === "MERCHANT_PAYABLE" ? "warning" : undefined}
            />
          );
        })}
        {sorted.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              هنوز حرکتی در دفتر ثبت نشده است
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-start font-medium px-4 py-3">تاریخ</th>
                  <th className="text-start font-medium px-4 py-3">رویداد</th>
                  <th className="text-start font-medium px-4 py-3">حساب</th>
                  <th className="text-start font-medium px-4 py-3">مبلغ</th>
                  <th className="text-start font-medium px-4 py-3">مرجع</th>
                  <th className="text-start font-medium px-4 py-3">تاجر</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      دفتر خالی است
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => {
                    const negative = e.amount.startsWith("-");
                    return (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-4 py-3 text-muted-foreground">
                          <JalaliDate iso={e.createdAt} />
                        </td>
                        <td className="px-4 py-3">{KIND_FA[e.kind] ?? e.kind}</td>
                        <td className="px-4 py-3">{ACCOUNT_FA[e.account] ?? e.account}</td>
                        <td
                          className={`px-4 py-3 font-mono text-xs ${negative ? "text-destructive" : "text-success"}`}
                        >
                          <Ltr>
                            {toPersianDigits(formatAmount(Number(e.amount)))}{" "}
                            {e.unit === "IRR" ? "ریال" : e.unit}
                          </Ltr>
                        </td>
                        <td className="px-4 py-3">
                          <Ltr className="font-mono text-xs">{e.subjectRef ?? "—"}</Ltr>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {e.userName ? `${e.userName} (${e.userUid})` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
