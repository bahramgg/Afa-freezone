import { cn } from "@/lib/cn";

/**
 * Wraps latin-script values — addresses, hashes, account numbers, IDs — so
 * their characters order left-to-right without flipping how the surrounding
 * RTL cell aligns its content. Putting `dir="ltr"` on the cell itself would
 * also move `text-start` to the left edge and break column alignment.
 */
export function Ltr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" className={cn("inline-block", className)}>
      {children}
    </span>
  );
}
