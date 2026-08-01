"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useInvoicesStore } from "@/lib/stores/invoices";
import { useHydrated } from "@/lib/stores/hydration";
import { PaymentScreen } from "@/components/invoice/PaymentScreen";
import { Skeleton } from "@/components/ui/Skeleton";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const invoice = useInvoicesStore((s) => s.list.find((i) => i.id === id));
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated && !invoice) router.replace("/receive");
  }, [hydrated, invoice, router]);

  if (!hydrated || !invoice) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <PaymentScreen invoice={invoice} />;
}
