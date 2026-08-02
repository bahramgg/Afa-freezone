import Link from "next/link";
import { notFound } from "next/navigation";
import { LogIn } from "lucide-react";
import { Checkout } from "@/components/checkout/Checkout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { checkoutView } from "@/lib/server/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "Payment — AFA Gateway" };

/**
 * The link a merchant sends their buyer.
 *
 * The invoice names the account it was raised for, so this shows it only to
 * that buyer — an export brings currency into the country and who sent it is
 * exactly what has to be recorded. Anyone else is asked to sign in rather than
 * told whether the invoice exists.
 */
export default async function PayPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const access = await checkoutView(ref);

  if (access.state === "not-found") notFound();

  if (access.state === "sign-in") {
    return (
      <div dir="ltr" className="min-h-screen bg-muted/30 px-4 py-16 text-start">
        <div className="mx-auto w-full max-w-md">
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <LogIn className="mx-auto h-9 w-9 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Sign in to view this payment request</h1>
              <p className="text-sm text-muted-foreground">
                Payment requests are issued to a named account. Sign in with the account the
                seller addressed this to, or register to receive your buyer ID and give it to
                them.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link href={`/foreign/login?next=/pay/${ref}`}>Sign in</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/foreign/register">Create an account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <Checkout reference={ref} initial={access.data} />;
}
