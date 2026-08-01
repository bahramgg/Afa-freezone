import Image from "next/image";
import { cn } from "@/lib/cn";

export function Logo({
  withText = true,
  size = 32,
  className,
}: {
  withText?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image src="/afa-logo.png" alt="AFA" width={size} height={size} priority />
      {withText ? (
        <span className="text-base font-semibold tracking-tight text-foreground">
          AFA<span className="text-primary">.CO</span>
        </span>
      ) : null}
    </div>
  );
}
