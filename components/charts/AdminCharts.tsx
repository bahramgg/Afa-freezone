"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { useMemo } from "react";
import { monthlyCumulative, monthlyTotals } from "@/lib/series";
import { useAdminUsersStore } from "@/lib/stores/adminUsers";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { toPersianDigits } from "@/lib/format";

/** How many accounts exist, month by month. Counted, not drawn from a table. */
export function UserGrowthChart() {
  const users = useAdminUsersStore((s) => s.list);
  const data = useMemo(() => monthlyCumulative(users, 6), [users]);
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8 }}>
          <defs>
            <linearGradient id="adm-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.42 0.22 275)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="oklch(0.42 0.22 275)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="month" tick={CHART_AXIS_TICK} reversed />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => toPersianDigits(v)} width={40} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            formatter={((v: unknown) => [toPersianDigits(Number(v)) + " کاربر", "تعداد"]) as never}
          />
          <Area
            type="monotone"
            dataKey="users"
            stroke="oklch(0.42 0.22 275)"
            fill="url(#adm-grad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Invoice volume by direction, month by month.
 *
 * Exports and imports rather than "received and sent": those are the two
 * directions the system actually has, and the amounts are in the settled token
 * so nothing has to be converted to compare them.
 */
export function AdminVolumeChart() {
  const invoices = useInvoicesStore((s) => s.list);
  const data = useMemo(
    () =>
      monthlyTotals(
        invoices,
        {
          received: (i) => (i.tradeDirection !== "IMPORT" ? i.amount : 0),
          sent: (i) => (i.tradeDirection === "IMPORT" ? i.amount : 0),
        },
        6,
      ),
    [invoices],
  );
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="month" tick={CHART_AXIS_TICK} reversed />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => toPersianDigits(v)} width={50} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            formatter={((v: unknown) => [toPersianDigits(Number(v)) + " USDT", "حجم"]) as never}
          />
          <Bar dataKey="volume" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
