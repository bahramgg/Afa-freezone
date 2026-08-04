import { check, jar, post, run, step, BASE, STAFF } from "./harness";
import { DESKTOP, launch, openAs, overflow, PHONE, visit } from "./browser";

/**
 * Signing in the way a person does: type an address, type the code, land in a
 * panel — and, for whoever cannot be bothered, follow the link in the email.
 *
 * Both spend the same single-use record, so this also checks that the panel a
 * role has no business in stays shut whichever door they came through.
 */
async function main() {
  const browser = await launch();
  const errors: string[] = [];

  /** The link the sign-in email carries, handed back outside production. */
  async function devLink(email: string) {
    const req = await post(jar(), "/api/auth/otp/request", { email });
    const link = req.body?.data?.devLink;
    if (!link) throw new Error(`no sign-in link for ${email}: ${JSON.stringify(req.body).slice(0, 200)}`);
    return link as string;
  }

  try {
    step("an unauthenticated visitor is sent to sign in");
    for (const path of [
      "/dashboard",
      "/admin/dashboard",
      "/bank/dashboard",
      "/foreign/dashboard",
      "/system/users",
    ]) {
      const s = await openAs(browser, null, PHONE);
      await visit(s.page, path, 1500);
      check(`${path} → /login`, s.page.url().endsWith("/login"), s.page.url().replace(BASE, ""));
      errors.push(...s.errors);
      await s.close();
    }

    step("the login form takes an address and then a code");
    for (const [email, expected] of [
      [STAFF.admin, "/admin/dashboard"],
      [STAFF.bank, "/bank/dashboard"],
      [STAFF.system, "/system/users"],
    ]) {
      const s = await openAs(browser, null, PHONE);
      await visit(s.page, "/login", 300);
      check(`${email}: no sideways scroll at 390px`, (await overflow(s.page)) <= 1);
      await s.page.getByLabel("ایمیل").fill(email);
      await s.page.getByRole("button", { name: "ارسال کد ورود" }).click();
      await s.page.getByLabel("کد ورود").waitFor({ timeout: 10_000 });
      // Outside production the field arrives filled — the same thing a person
      // does by pasting the code out of their mail.
      await s.page.getByRole("button", { name: "ورود", exact: true }).click();
      await s.page.waitForURL(`**${expected}`, { timeout: 12_000 }).catch(() => {});
      check(
        `${email} lands on ${expected}`,
        s.page.url().endsWith(expected),
        s.page.url().replace(BASE, ""),
      );
      errors.push(...s.errors);
      await s.close();
    }

    step("the emailed link signs you in without typing anything");
    {
      const s = await openAs(browser, null, PHONE);
      await s.page.goto(await devLink(STAFF.system), { waitUntil: "networkidle" });
      await s.page.waitForURL("**/system/users", { timeout: 12_000 }).catch(() => {});
      check(
        "the link lands straight in the system panel",
        s.page.url().endsWith("/system/users"),
        s.page.url().replace(BASE, ""),
      );
      errors.push(...s.errors);
      await s.close();
    }

    step("the system panel works");
    {
      const s = await openAs(browser, null, DESKTOP);
      await s.page.goto(await devLink(STAFF.system), { waitUntil: "networkidle" });
      await s.page.waitForURL("**/system/users", { timeout: 12_000 }).catch(() => {});

      for (const [path, heading] of [
        ["/system/users", "کاربران"],
        ["/system/logs", "گزارش رویدادها"],
        ["/system/access", "دسترسی ثبت‌نام"],
      ]) {
        await visit(s.page, path);
        check(`${path} renders`, await s.page.getByRole("heading", { name: heading }).isVisible());
        const text = await s.page.innerText("body");
        check(`${path} has content`, text.length > 300, `${text.length} chars`);
      }

      await visit(s.page, "/system/users");
      const rows = await s.page.evaluate(() => document.querySelectorAll("tbody tr").length);
      check("the user table is populated", rows > 0, rows);
      check("staff are on the first page", (await s.page.innerText("body")).includes("بانک عامل"));
      errors.push(...s.errors);
      await s.close();
    }

    step("the system panel refuses an organisation operator");
    {
      const s = await openAs(browser, null, DESKTOP);
      await s.page.goto(await devLink(STAFF.admin), { waitUntil: "networkidle" });
      await s.page.waitForTimeout(1500);
      await visit(s.page, "/system/users", 1500);
      check(
        "an admin is bounced out of /system",
        s.page.url().endsWith("/login"),
        s.page.url().replace(BASE, ""),
      );
      await s.close();
    }

    check("nothing threw in the browser", errors.length === 0, errors.join("\n"));
  } finally {
    await browser.close();
  }
}

run(main);
