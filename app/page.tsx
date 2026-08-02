import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { PortalGrid } from "@/components/landing/PortalGrid";

/**
 * Entry point of an internal system, not a marketing site: it names the system
 * and routes each role to its panel.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-14">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            سامانه پرداخت ارزی سازمان منطقه آزاد
          </h1>
          <p className="mt-3 text-pretty leading-8 text-muted-foreground">
            سامانه یکپارچه ثبت و پیگیری دریافت، ارسال و تسویه وجوه ارزی بازرگانان منطقه
            آزاد. برای ادامه، پنل مربوط به نقش خود را انتخاب کنید.
          </p>
        </div>

        <h2 className="mt-10 text-sm font-medium text-muted-foreground">انتخاب پنل</h2>
        <div className="mt-3">
          <PortalGrid />
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
