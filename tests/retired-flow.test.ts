import { check, run, sessionCookie, step, BASE, STAFF } from "./harness";
import { DESKTOP, launch, openAs, visit } from "./browser";

/**
 * The retired send flow is gone from every panel, and nothing it left behind
 * broke on the way out.
 *
 * Removing a flow is easy; removing it without leaving a link that 404s, a menu
 * entry nobody can use, or a report that still tries to build a workbook from
 * it is the part worth checking.
 */
async function main() {
  const browser = await launch();
  const errors: string[] = [];

  const cookies = {
    merchant: await sessionCookie(STAFF.merchant),
    admin: await sessionCookie(STAFF.admin),
    bank: await sessionCookie(STAFF.bank),
    foreign: await foreignCookie(),
  };
  const cookieFor = (path: string) =>
    path.startsWith("/foreign")
      ? cookies.foreign
      : path.startsWith("/bank")
        ? cookies.bank
        : path.startsWith("/admin")
          ? cookies.admin
          : cookies.merchant;

  try {
    step("the pages and the API are gone");
    for (const path of ["/send", "/foreign/requests", "/bank/send", "/admin/send"]) {
      const res = await fetch(BASE + path);
      check(`${path} is no longer served`, res.status === 404, res.status);
    }
    for (const method of ["GET", "POST"]) {
      const res = await fetch(BASE + "/api/sends", {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      });
      check(`${method} /api/sends is gone`, res.status === 404, res.status);
    }

    step("no panel still advertises it");
    for (const path of [
      "/dashboard",
      "/foreign/dashboard",
      "/bank/dashboard",
      "/admin/dashboard",
    ]) {
      const s = await openAs(browser, cookieFor(path), DESKTOP);
      await visit(s.page, path, 1400);
      const links = await s.page.evaluate(() =>
        [...document.querySelectorAll("aside a")].map(
          (a) => `${a.textContent?.trim()}|${a.getAttribute("href")}`,
        ),
      );
      const stale = links.filter(
        (l) => l.includes("بازنشسته") || l.includes("/send") || l.includes("/foreign/requests"),
      );
      check(`${path}: menu is clean`, stale.length === 0, stale);
      const text = await s.page.innerText("body");
      check(`${path}: renders with content`, text.length > 300, `${text.length} chars`);
      check(
        `${path}: no stale wording on the page`,
        !text.includes("بازنشسته") && !text.includes("ارسال وجه"),
        /.{0,30}(بازنشسته|ارسال وجه).{0,20}/.exec(text)?.[0],
      );
      errors.push(...s.errors.map((e) => `${path}: ${e}`));
      await s.close();
    }

    step("the pages that read what it used to feed still work");
    for (const path of [
      "/reports",
      "/foreign/reports",
      "/bank/reports",
      "/admin/reports",
      "/admin/ledger",
      "/bank/imports",
      "/imports",
    ]) {
      const s = await openAs(browser, cookieFor(path), DESKTOP);
      const res = await visit(s.page, path);
      const text = await s.page.innerText("body");
      check(
        `${path} renders`,
        res?.status() === 200 && text.length > 200,
        `${res?.status()} / ${text.length} chars`,
      );
      errors.push(...s.errors.map((e) => `${path}: ${e}`));
      await s.close();
    }

    step("the excel exports no longer offer a sends workbook");
    {
      const s = await openAs(browser, cookies.admin, DESKTOP);
      await visit(s.page, "/admin/reports");
      const refused = await s.context.request.get(BASE + "/api/reports/export?dataset=sends");
      check(
        "asking for it is refused",
        refused.status() === 400 || refused.status() === 422,
        refused.status(),
      );
      const invoices = await s.context.request.get(BASE + "/api/reports/export?dataset=invoices");
      check("the invoices workbook still builds", invoices.status() === 200, invoices.status());
      await s.close();
    }

    check("nothing threw in the browser", errors.length === 0, errors.join("\n"));
  } finally {
    await browser.close();
  }
}

/** Whichever foreign merchant the flow suites registered, or a fresh one. */
async function foreignCookie() {
  const { db, jar, post, unique } = await import("./harness");
  const existing = await db.user.findFirst({
    where: { role: "FOREIGN", disabledAt: null, email: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });
  if (existing?.email) return sessionCookie(existing.email);

  const email = `${unique("retired.foreign")}@afa.local`;
  await post(jar(), "/api/auth/register", {
    fullName: "Retired Flow Buyer",
    email,
    passportNo: "RET1",
    country: "China",
  });
  return sessionCookie(email);
}

run(main);
