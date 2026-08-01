"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { toPersianDigits } from "@/lib/format";

const DATA = [
  { month: "آذر", received: 4200, sent: 1800 },
  { month: "دی", received: 5100, sent: 2400 },
  { month: "بهمن", received: 6300, sent: 2800 },
  { month: "اسفند", received: 7200, sent: 3500 },
  { month: "فروردین", received: 5900, sent: 2900 },
  { month: "اردیبهشت", received: 8100, sent: 3700 },
];

export function MonthlyVolumeChart() {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="month" tick={CHART_AXIS_TICK} reversed />
          <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => toPersianDigits(v)} width={50} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            formatter={((v: unknown, n: unknown) => [
              toPersianDigits(Number(v)),
              n === "received" ? "دریافتی" : "پرداختی",
            ]) as never}
          />
          <Legend formatter={(v) => (v === "received" ? "دریافتی" : "پرداختی")} />
          <Bar dataKey="received" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="sent" fill="oklch(0.42 0.22 275)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
