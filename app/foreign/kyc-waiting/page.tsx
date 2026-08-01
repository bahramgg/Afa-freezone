"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/Logo";
import { useForeignStore } from "@/lib/stores/foreign";

export default function ForeignKycWaitingPage() {
  const router = useRouter();
  const reloadForeign = useForeignStore((s) => s.load);

  const hasPassedKyc = useForeignStore((s) => s.hasPassedKyc);

  // A reviewer approves from the admin panel, so this page polls for the
  // decision rather than simulating one after a delay.
  useEffect(() => {
    if (hasPassedKyc) return;
    const timer = setInterval(() => void reloadForeign(), 15_000);
    return () => clearInterval(timer);
  }, [hasPassedKyc, reloadForeign]);

  useEffect(() => {
    if (!hasPassedKyc) return;
    toast.success("احراز هویت تأیید شد");
    router.replace("/foreign/dashboard");
  }, [hasPassedKyc, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-info/5 to-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <Logo className="mx-auto" />
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 rounded-full bg-info/10 pulse-ring" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="h-12 w-12 text-info" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">در حال بررسی مدارک</h1>
          <p className="text-sm text-muted-foreground">
            احراز هویت بین‌المللی شما در حال بررسی است...
          </p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-info" />
      </motion.div>
    </div>
  );
}
