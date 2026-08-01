import { notFound } from "next/navigation";
import { Checkout } from "@/components/checkout/Checkout";
import { checkoutView } from "@/lib/server/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Payment — AFA Gateway" };

/**
 * The buyer's entry point, deliberately outside every panel and every guard.
 *
 * A foreign buyer has no account here and never will: the merchant sends them
 * this link and nothing else is asked of them. The invoice is read here on the
 * server so the page arrives complete, and the client only watches for the
 * payment to land.
 */
export default async function PayPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const data = await checkoutView(ref);
  if (!data) notFound();

  return <Checkout reference={ref} initial={data} />;
}
