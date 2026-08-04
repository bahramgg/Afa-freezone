import { check, get, jar, post, run, sessionCookie, signIn, step, unique, STAFF } from "./harness";
import { launch, openAs, overflow, visit } from "./browser";

/**
 * The import path, walked in a real browser.
 *
 * The seller fills in the form and sees the fee added on top of their price,
 * the importer sees a rial figure and an account number, the bank prices it and
 * confirms the rial. Every page is checked for sideways scroll at 390px and for
 * anything reaching the console, because an import is where the money leaves
 * the country and a screen that silently fails is the worst place for it.
 */
async function main() {
  const browser = await launch();
  const consoleErrors: string[] = [];

  /** Opens a page as someone and remembers anything it complains about. */
  const open = async (cookie: string, path: string) => {
    const s = await openAs(browser, cookie, { width: 390, height: 844 });
    s.page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`${path}: ${m.text()}`);
    });
    s.page.on("pageerror", (e) => consoleErrors.push(`${path}: ${e.message}`));
    await visit(s.page, path, 0);
    return s;
  };

  try {
    const adminJar = jar();
    const bankJar = jar();
    const importerJar = jar();
    await signIn(adminJar, STAFF.admin);
    await signIn(bankJar, STAFF.bank);
    await signIn(importerJar, STAFF.merchant);

    const bankCookie = await sessionCookie(STAFF.bank);
    const importerCookie = await sessionCookie(STAFF.merchant);
    const importerUid = (await get(importerJar, "/api/auth/me")).body?.data?.user?.uid;

    const sellerJar = jar();
    const sellerEmail = `${unique("ningbo.browser")}@afa.local`;
    await post(sellerJar, "/api/auth/register", {
      fullName: "Ningbo Browser Co.",
      email: sellerEmail,
      passportNo: "CNB1",
      country: "China",
    });
    const sellerUid = (await get(sellerJar, "/api/auth/me")).body?.data?.user?.uid;
    await post(adminJar, `/api/admin/kyc/${sellerUid}`, { action: "approve" });
    const sellerCookie = sellerJar.cookie.split("=").slice(1).join("=");

    step("the seller fills in the form and sees the fee added on top");
    {
      const s = await open(sellerCookie, "/foreign/imports");
      // Scoped to the heading: the same words sit in the sidebar, hidden at
      // this width but still in the page's text.
      check(
        "the page renders",
        await s.page.getByRole("heading", { name: "فاکتورهای فروش" }).isVisible(),
      );
      check("no sideways scroll at 390px", (await overflow(s.page)) <= 1);

      await s.page.getByRole("button", { name: "صدور فاکتور فروش" }).click();
      await s.page.getByLabel("شناسهٔ واردکنندهٔ ایرانی").fill(importerUid);
      await s.page.getByLabel("عنوان کالا").fill("قطعات صنعتی");
      await s.page.getByLabel("مبلغ اصل قرارداد").fill("120");
      await s.page
        .getByLabel("کیف پول شما برای دریافت وجه")
        .fill("0x4d7c3f2ae8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3");
      await s.page.getByLabel("توضیحات").fill("واردات آزمایشی");

      const dialog = s.page.getByRole("dialog");
      await dialog.getByText("پرداختی واردکننده").waitFor({ timeout: 5000 });
      const previewed = await dialog.innerText();
      check("the seller's own share is shown", previewed.includes("سهم شما"), previewed.slice(0, 200));
      check("and the importer's total is 122.4, not 120", /۱۲۲٫۴/.test(previewed), previewed);

      await dialog.getByRole("button", { name: "ثبت فاکتور" }).click();
      await s.page.getByText("فاکتور صادر شد").waitFor({ timeout: 10_000 });
      check("the invoice was raised", true);
      await s.close();
    }

    const raised = (await get(sellerJar, "/api/invoices?status=ALL")).body?.data?.list ?? [];
    const invoice = raised.find((i: any) => i.tradeDirection === "IMPORT");
    check(
      "it carries the seller's figure and the system's fee",
      invoice?.amount === 120 && invoice?.fee === 2.4,
      { amount: invoice?.amount, fee: invoice?.fee },
    );

    step("the organisation approves it");
    const approved = await post(adminJar, `/api/invoices/${invoice.id}/transition`, {
      action: "approve",
    });
    const paymentAddress = approved.body?.data?.invoice?.paymentAddress ?? "";
    check(
      "approved with a contract address",
      /^0x[a-f0-9]{40}$/.test(paymentAddress),
      paymentAddress,
    );

    step("the bank prices it and names an account");
    {
      const s = await open(bankCookie, "/bank/imports");
      check(
        "the bank page renders",
        await s.page.getByRole("heading", { name: "واردات — تأمین ارز" }).isVisible(),
      );
      check("no sideways scroll at 390px", (await overflow(s.page)) <= 1);

      await s.page.locator(`text=${invoice.id}`).first().waitFor({ timeout: 6000 });
      check("the invoice is waiting there", true);

      await s.page.getByPlaceholder("IR…").first().fill("IR84-0170-0000-0011-2233-44");
      await s.page.locator('input[inputmode="numeric"]').first().fill("70000");
      await s.page.getByText("واردکننده", { exact: false }).first().waitFor();
      await s.page.getByRole("button", { name: "قفل نرخ" }).click();
      await s.page.getByText("نرخ قفل شد", { exact: false }).waitFor({ timeout: 10_000 });
      check("the rate was locked from the panel", true);
      await s.close();
    }

    const priced = (await get(bankJar, "/api/invoices?status=ALL")).body?.data?.list?.find(
      (i: any) => i.id === invoice.id,
    );
    check(
      "the importer owes for principal plus fee",
      priced?.rialAmount === 122.4 * 70000,
      priced?.rialAmount,
    );

    step("the importer sees what to pay and where");
    {
      const s = await open(importerCookie, "/imports");
      check(
        "the importer page renders",
        await s.page
          .getByRole("heading", { name: "واردات — فاکتورهای فروشندگان خارجی" })
          .isVisible(),
      );
      check("no sideways scroll at 390px", (await overflow(s.page)) <= 1);
      const text = await s.page.innerText("body");
      check("the invoice is on it", text.includes(invoice.id), text.slice(0, 200));
      check(
        "the bank's account number reaches them",
        text.includes("IR84-0170-0000-0011-2233-44"),
        text.slice(0, 400),
      );
      check("and the rial figure with it", /۸٬۵۶۸٬۰۰۰/.test(text), text.slice(0, 600));
      await s.close();
    }

    step("the bank confirms the rial and is told where to send the currency");
    {
      const s = await open(bankCookie, "/bank/imports");
      await s.page.getByRole("button", { name: "تأیید دریافت ریال" }).waitFor({ timeout: 6000 });
      await s.page.locator('input.font-mono[dir="ltr"]').last().fill("TR-BROWSER-1");
      await s.page.getByRole("button", { name: "تأیید دریافت ریال" }).click();
      await s.page.getByText("واریز ریالی ثبت شد", { exact: false }).waitFor({ timeout: 10_000 });
      const text = await s.page.innerText("body");
      check(
        "the contract address is shown to send to",
        text.includes(paymentAddress.slice(0, 10)),
        text.slice(0, 400),
      );
      check("with the full amount including the fee", /۱۲۲٫۴/.test(text), text.slice(0, 400));
      check("no sideways scroll at 390px", (await overflow(s.page)) <= 1);
      await s.close();
    }

    step("the seller's own list shows it in flight");
    {
      const s = await open(sellerCookie, "/foreign/imports");
      const text = await s.page.innerText("body");
      check("the invoice is listed", text.includes(invoice.id), text.slice(0, 300));
      check("with the wallet it will be paid into", text.includes("0x4d7c"), text.slice(0, 400));
      await s.close();
    }

    check("nothing reached the console", consoleErrors.length === 0, consoleErrors.join("\n"));
  } finally {
    await browser.close();
  }
}

run(main);
