"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function CopyButton({
  value,
  label = "کپی",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("در کلیپ‌بورد کپی شد");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("کپی ناموفق بود");
        }
      }}
      className={cn("gap-1.5", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </Button>
  );
}
