"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_GRID,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "./theme";
import { dailyTotals } from "@/lib/series";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { formatJalali, toPersianDigits } from "@/lib/format";

/**
 * The last thirty days of this merchant's own invoices.
 *
 * Split the way the merchant thinks about them: what they are owed for selling
 * abroad, and what they owe for buying.
 */
export function ActivityChart() {
  const invoices = useInvoicesStore((s) => s.list);
  const data = useMemo(
    () =>
      dailyTotals(
        invoices,
        {
          received: (i) => (i.tradeDirection !== "IMPORT" ? i.amount : 0),
          sent: (i) => (i.tradeDirection === "IMPORT" ? i.amount : 0),
        },
        30,
      ).map((d) => ({ ...d, label: formatJalali(d.date).slice(5) })),
    [invoices],
  );

  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-rec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.18 155)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.65 0.18 155)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.42 0.22 275)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.42 0.22 275)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} interval={4} />
          <YAxis tick={CHART_AXIS_TICK} width={50} tickFormatter={(v) => toPersianDigits(v)} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            formatter={((v: unknown, name: unknown) => [
              toPersianDigits(Number(v)) + " USDT",
              name === "received" ? "دریافتی" : "پرداختی",
            ]) as never}
            labelFormatter={(l) => `تاریخ: ${l}`}
          />
          <Area
            type="monotone"
            dataKey="received"
            stroke="oklch(0.65 0.18 155)"
            fill="url(#grad-rec)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="sent"
            stroke="oklch(0.42 0.22 275)"
            fill="url(#grad-sent)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
