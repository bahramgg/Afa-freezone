import { GuideGrid } from "@/components/landing/GuideGrid";
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

        {/* Below the directory, because it answers a different question: not
            "which panel is mine" but "what does this system actually do". */}
        <div className="mt-14 border-t border-border pt-10">
          <h2 className="text-lg font-semibold tracking-tight">راهنمای کارکرد سامانه</h2>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-7 text-muted-foreground">
            برای هر پنل یک ویدئوی راهنما و یک سند متنی تهیه شده است: مسیر کامل یک معامله از صدور
            فاکتور تا تسویهٔ نهایی، به‌صورت نمودار و گام‌به‌گام. ویدئوها صدا ندارند و همهٔ توضیحات
            روی تصویر نوشته شده است.
          </p>
          <div className="mt-5">
            <GuideGrid />
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
