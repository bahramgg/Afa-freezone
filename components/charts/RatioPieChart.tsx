"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function RatioPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            stroke="none"
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid oklch(0.92 0.01 260)",
              fontFamily: "var(--font-vazirmatn)",
              direction: "rtl",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
