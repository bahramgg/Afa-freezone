import { ArrowLeft, Eye, KeyRound, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "نظارت سازمانی",
    body: "هر تراکنش پیش از اجرا توسط کارشناس سازمان منطقه آزاد بررسی و تأیید می‌شود.",
  },
  {
    icon: ScanLine,
    title: "راستی‌آزمایی روی زنجیره",
    body: "مبلغ، آدرس و تعداد تأییدیه هر واریز مستقیماً از شبکه BSC خوانده و تطبیق داده می‌شود.",
  },
  {
    icon: KeyRound,
    title: "تفکیک کیف پول‌ها",
    body: "کیف پول‌های دریافت و ارسال بانک از هم جدا هستند و دسترسی به کلیدها محدود و کنترل‌شده است.",
  },
  {
    icon: Eye,
    title: "سابقه قابل ممیزی",
    body: "تمام تغییرات وضعیت با زمان، عامل و دلیل ثبت می‌شود و برای بازرسی در دسترس است.",
  },
];

export function Security() {
  return (
    <section id="security" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              امنیت و انطباق
            </span>
            <h2 className="mt-5 text-balance text-2xl font-bold leading-snug tracking-tight sm:text-3xl sm:leading-snug">
              پول در مسیری حرکت می‌کند که همه طرف‌ها آن را می‌بینند
            </h2>
            <p className="mt-4 text-pretty leading-8 text-muted-foreground">
              سامانه به‌گونه‌ای طراحی شده که هیچ مرحله‌ای خارج از دید نهاد ناظر انجام نشود:
              بازرگان، سازمان و بانک هر کدام وضعیت لحظه‌ای تراکنش را می‌بینند و هر اقدام در
              سابقه ثبت می‌شود.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href="#portals">
                  شروع کنید
                  <ArrowLeft className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                  <Icon className="h-5 w-5 text-success" />
                  <h3 className="mt-3 font-semibold leading-tight">{p.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
