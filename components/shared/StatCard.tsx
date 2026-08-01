import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { type LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";

type Trend = "up" | "down" | "flat";

export function StatCard({
  label,
  value,
  delta,
  trend = "flat",
  icon: Icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  trend?: Trend;
  icon?: LucideIcon;
  hint?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-success bg-success/10"
      : trend === "down"
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            {Icon ? (
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            {delta ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  trendColor,
                )}
              >
                <TrendIcon className="h-3 w-3" />
                <span>{delta}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
