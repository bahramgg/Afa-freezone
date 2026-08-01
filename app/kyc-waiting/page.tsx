"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/stores/auth";
import { useKycStore } from "@/lib/stores/kyc";
import { useHydrated } from "@/lib/stores/hydration";
import { toast } from "sonner";

export default function KycWaitingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const markKycApproved = useAuthStore((s) => s.markKycApproved);
  const hydrated = useHydrated();

  const kycStatus = useKycStore((s) =>
    user?.uid ? s.requests.find((r) => r.uid === user.uid)?.status ?? null : null
  );
  const rejectNote = useKycStore((s) =>
    user?.uid ? s.requests.find((r) => r.uid === user.uid)?.rejectNote : undefined
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthed) router.replace("/login");
  }, [hydrated, isAuthed, router]);

  useEffect(() => {
    if (kycStatus === "APPROVED") {
      markKycApproved();
      toast.success("احراز هویت تأیید شد", {
        description: "اکنون می‌توانید از پنل استفاده کنید",
      });
      router.replace("/dashboard");
    }
  }, [kycStatus, markKycApproved, router]);

  if (kycStatus === "REJECTED") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-9 w-9" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">احراز هویت رد شد</h1>
            <p className="text-sm text-muted-foreground leading-7">
              متأسفانه درخواست احراز هویت شما تأیید نشد.
            </p>
            {rejectNote ? (
              <p className="text-sm text-destructive leading-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2">
                {rejectNote}
              </p>
            ) : null}
          </div>
          <Button onClick={() => router.push("/profile")}>
            ویرایش اطلاعات و ارسال مجدد
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary pulse-ring"
        >
          <ShieldCheck className="h-9 w-9" />
        </motion.div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">اطلاعات شما در حال بررسی است...</h1>
          <p className="text-sm text-muted-foreground leading-7">
            تیم ما در حال راستی‌آزمایی اطلاعات هویتی شماست.
            <br />
            لطفاً منتظر بمانید تا ادمین درخواست شما را بررسی کند.
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
