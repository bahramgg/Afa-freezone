import { check, run, sessionCookie, step, STAFF } from "./harness";
import { launch, landedOn, openAs, overflow, PHONE, visit } from "./browser";

/**
 * Every page of every panel, opened as the role that owns it.
 *
 * Four things per page: it answers, it renders something rather than a shell,
 * it does not scroll sideways on a phone, and nothing reaches the console. A
 * page that redirects somewhere unexpected fails too — that is how a
 * misconfigured guard hides, serving a redirect that looks like success.
 */
const PANELS: Array<[string, keyof typeof STAFF | "foreign", Array<[string, string]>]> = [
  [
    "بازرگان داخلی",
    "merchant",
    [
      ["/dashboard", "داشبورد"],
      ["/receive", "صادرات"],
      ["/imports", "واردات"],
      ["/settlement", "تسویه"],
      ["/wallets", "والت"],
      ["/reports", "گزارش"],
      ["/settings", "تنظیمات"],
    ],
  ],
  [
    "بازرگان خارجی",
    "foreign",
    [
      ["/foreign/dashboard", "داشبورد"],
      ["/foreign/invoices", "پرداخت"],
      ["/foreign/imports", "فروش"],
      ["/foreign/wallets", "والت"],
      ["/foreign/reports", "گزارش"],
      ["/foreign/settings", "تنظیمات"],
    ],
  ],
  [
    "سازمان",
    "admin",
    [
      ["/admin/dashboard", "داشبورد"],
      ["/admin/invoices", "فاکتور"],
      ["/admin/kyc", "احراز"],
      ["/admin/users", "کاربر"],
      ["/admin/settlements", "تسویه"],
      ["/admin/refunds", "بازگشت"],
      ["/admin/ledger", "دفتر"],
      ["/admin/transactions", "تراکنش"],
      ["/admin/reports", "گزارش"],
      ["/admin/settings", "تنظیمات"],
    ],
  ],
  [
    "بانک",
    "bank",
    [
      ["/bank/dashboard", "داشبورد"],
      ["/bank/imports", "واردات"],
      ["/bank/deposits", "واریز"],
      ["/bank/settlement", "تسویه"],
      ["/bank/wallets", "کیف پول"],
      ["/bank/reports", "گزارش"],
      ["/bank/settings", "تنظیمات"],
    ],
  ],
  [
    "مدیریت سیستم",
    "system",
    [
      ["/system/users", "کاربران"],
      ["/system/logs", "رویداد"],
      ["/system/access", "دسترسی"],
    ],
  ],
];

/**
 * A foreign merchant to open the foreign panel with.
 *
 * There is no seeded one — foreign accounts are made by registering — so this
 * finds whichever registered account the flow suites left behind, and makes one
 * if the database has never seen a foreign merchant.
 */
async function foreignEmail() {
  const { db } = await import("./harness");
  const existing = await db.user.findFirst({
    where: { role: "FOREIGN", disabledAt: null, email: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });
  if (existing?.email) return existing.email;

  const { post, jar, unique } = await import("./harness");
  const email = `${unique("pages.foreign")}@afa.local`;
  await post(jar(), "/api/auth/register", {
    fullName: "Pages Buyer",
    email,
    passportNo: "PAG1",
    country: "China",
  });
  return email;
}

async function main() {
  const cookies: Record<string, string> = {
    merchant: await sessionCookie(STAFF.merchant),
    admin: await sessionCookie(STAFF.admin),
    bank: await sessionCookie(STAFF.bank),
    system: await sessionCookie(STAFF.system),
    foreign: await sessionCookie(await foreignEmail()),
  };

  const browser = await launch();
  try {
    for (const [panel, who, pages] of PANELS) {
      step(panel);
      for (const [path, marker] of pages) {
        const session = await openAs(browser, cookies[who], PHONE);
        try {
          const res = await visit(session.page, path, 900);
          const text = await session.page.innerText("body");
          const landed = landedOn(session.page);
          const over = await overflow(session.page);

          const ok =
            res?.status() === 200 &&
            landed === path &&
            text.includes(marker) &&
            text.length > 150 &&
            over <= 1 &&
            session.errors.length === 0;

          check(
            path,
            ok,
            ok
              ? undefined
              : `status=${res?.status()} landed=${landed} marker=${text.includes(marker)} ` +
                  `chars=${text.length} overflow=${over} errors=${session.errors.slice(0, 1)}`,
          );
        } catch (error) {
          check(path, false, `navigation failed: ${error}`);
        } finally {
          await session.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

run(main);
