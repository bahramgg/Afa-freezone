"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Sparkline({ data, color = "oklch(0.42 0.22 275)" }: { data: number[]; color?: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
