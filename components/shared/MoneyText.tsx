import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Currency } from "@/lib/types";

export function MoneyText({
  amount,
  currency,
  className,
  sign,
}: {
  amount: number;
  currency: Currency;
  className?: string;
  sign?: "+" | "-";
}) {
  return (
    <span className={cn("tabular-nums font-medium", className)}>
      {sign}
      {formatCurrency(amount, currency)}
    </span>
  );
}
