import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { PORTALS } from "./portals";

const RESOURCES = [
  { href: "#how", label: "فرایند کار" },
  { href: "#features", label: "امکانات" },
  { href: "#security", label: "امنیت" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo size={30} />
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              سامانه پرداخت ارزی سازمان منطقه آزاد گلستان — زیرساخت دریافت، ارسال و تسویه
              وجوه بین‌المللی برای بازرگانان منطقه.
            </p>
          </div>

          <nav aria-labelledby="footer-portals">
            <h2 id="footer-portals" className="text-sm font-semibold">
              درگاه‌ها
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PORTALS.map((p) => (
                <li key={p.key}>
                  <Link
                    href={p.loginHref}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-resources">
            <h2 id="footer-resources" className="text-sm font-semibold">
              راهنما
            </h2>
            <ul className="mt-4 space-y-2.5">
              {RESOURCES.map((r) => (
                <li key={r.href}>
                  <a
                    href={r.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © ۱۴۰۵ سازمان منطقه آزاد گلستان — همه حقوق محفوظ است
          </p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            USDT · BNB · BSC Network
          </p>
        </div>
      </div>
    </footer>
  );
}
