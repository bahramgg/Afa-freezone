import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-base font-medium">{title}</div>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
