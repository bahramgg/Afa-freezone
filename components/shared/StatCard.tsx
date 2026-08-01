import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { type LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";

type Trend = "up" | "down" | "flat";

/** Matches the accent of the panel the card sits in, so icons don't read as foreign. */
type Tone = "primary" | "success" | "info" | "warning" | "destructive" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  delta,
  trend = "flat",
  icon: Icon,
  hint,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  trend?: Trend;
  icon?: LucideIcon;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-success bg-success/10"
      : trend === "down"
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted";

  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          {/* min-w-0 lets long amounts truncate instead of wrapping the card taller. */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="truncate text-sm text-muted-foreground" title={label}>
              {label}
            </div>
            <div className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {value}
            </div>
            {hint ? (
              <div className="truncate text-xs text-muted-foreground" title={hint}>
                {hint}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {Icon ? (
              <div className={cn("rounded-md p-2", TONE_CLASS[tone])}>
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            {delta ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs",
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
