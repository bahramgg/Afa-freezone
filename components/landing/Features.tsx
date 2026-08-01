import {
  BellRing,
  FileBarChart,
  Fingerprint,
  Landmark,
  Link2,
  Lock,
  Radar,
  ScrollText,
  Wallet,
} from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    title: "رصد خودکار زنجیره",
    body: "واریزها روی شبکه BSC به‌صورت لحظه‌ای رصد و تعداد تأییدیه‌ها تا نهایی شدن تراکنش دنبال می‌شود.",
  },
  {
    icon: Fingerprint,
    title: "احراز هویت کامل",
    body: "فرایند KYC مجزا برای بازرگان داخلی و طرف خارجی، با بررسی و تأیید کارشناس سازمان.",
  },
  {
    icon: Landmark,
    title: "اتصال به بانک عامل",
    body: "پنل اختصاصی بانک برای قفل نرخ ارز، مدیریت کیف پول‌ها و ثبت رسید واریز ریالی.",
  },
  {
    icon: Wallet,
    title: "مدیریت کیف پول",
    body: "ثبت و تأیید چند آدرس کیف پول برای هر کاربر، با امکان فعال و غیرفعال‌سازی.",
  },
  {
    icon: FileBarChart,
    title: "گزارش‌های تحلیلی",
    body: "نمودار حجم ماهانه، نسبت دریافت به ارسال و خروجی قابل استخراج برای حسابداری.",
  },
  {
    icon: BellRing,
    title: "اعلان لحظه‌ای",
    body: "اطلاع‌رسانی هر تغییر وضعیت به همه طرف‌های درگیر، بدون نیاز به پیگیری دستی.",
  },
  {
    icon: ScrollText,
    title: "سابقه کامل تراکنش",
    body: "هر تغییر وضعیت با زمان، عامل و دلیل ثبت می‌شود و قابل ممیزی است.",
  },
  {
    icon: Link2,
    title: "پیوند به BscScan",
    body: "هر تراکنش با هش قابل راستی‌آزمایی، مستقیماً روی مرورگر بلاک‌چین قابل بررسی است.",
  },
  {
    icon: Lock,
    title: "کنترل دسترسی نقش‌محور",
    body: "هر نقش تنها به داده‌ها و عملیات مربوط به خودش دسترسی دارد.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">امکانات سامانه</h2>
          <p className="mt-3 text-pretty leading-8 text-muted-foreground">
            آنچه برای یک چرخه کامل پرداخت ارزی لازم است — از صدور فاکتور تا تسویه نهایی.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 font-semibold leading-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
