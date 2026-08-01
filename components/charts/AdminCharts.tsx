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
import { useMemo } from "react";
import { adminVolumeSeries, userGrowthSeries } from "@/lib/mock/fixtures";
import { toPersianDigits } from "@/lib/format";

export function UserGrowthChart() {
  const data = useMemo(() => userGrowthSeries(6), []);
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
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontFamily: "var(--font-vazirmatn)",
              direction: "rtl",
            }}
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

export function AdminVolumeChart() {
  const data = useMemo(() => adminVolumeSeries(6), []);
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 260)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => toPersianDigits(v)} width={50} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              fontFamily: "var(--font-vazirmatn)",
              direction: "rtl",
            }}
            formatter={((v: unknown) => [toPersianDigits(Number(v)) + " USDT", "حجم"]) as never}
          />
          <Bar dataKey="volume" fill="oklch(0.65 0.18 155)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
