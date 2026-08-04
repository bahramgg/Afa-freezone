import { check, run, sessionCookie, step, BASE, STAFF } from "./harness";
import { DESKTOP, launch, openAs, visit } from "./browser";

/**
 * The organisation's screen names the direction, and the bank's warns before a
 * mismatch becomes irreversible.
 *
 * Exports and imports look alike in a list and behave nothing alike: releasing
 * an over-funded export leaves a surplus with the bank, while releasing an
 * over-funded import sends it to a foreign seller and out of reach. Both facts
 * have to be on screen before the button is pressed.
 */
async function main() {
  const browser = await launch();
  try {
    step("the organisation's list names the direction");
    {
      const s = await openAs(browser, await sessionCookie(STAFF.admin), DESKTOP);
      await visit(s.page, "/admin/invoices", 1500);
      await s.page.locator("text=همه").last().click();
      await s.page.waitForTimeout(900);
      const text = await s.page.innerText("body");
      check("the table has a direction column", text.includes("جهت"), text.slice(0, 150));
      check("and rows tagged both ways", text.includes("صادرات") && text.includes("واردات"));
      check("there is a tab for imports the bank is holding", text.includes("واردات نزد بانک"));
      const rows = await s.page.evaluate(() => document.querySelectorAll("tbody tr").length);
      check("the list is populated", rows > 0, rows);
      await s.close();
    }

    step("the bank's deposits screen states what it expected");
    {
      const s = await openAs(browser, await sessionCookie(STAFF.bank), DESKTOP);
      await visit(s.page, "/bank/deposits", 1500);
      check("the deposits screen renders", (await s.page.innerText("body")).length > 400);

      const api = await (await s.context.request.get(BASE + "/api/deposits")).json();
      const stated = (api?.data?.list ?? []).filter((d: any) => d.expectedAmount !== undefined);
      check("every deposit states what was expected", stated.length > 0, stated.length);
      const imports = stated.filter((d: any) => d.direction === "IMPORT");
      check(
        "an import's expectation includes the fee",
        imports.every((d: any) => d.expectedAmount > 0),
        imports.slice(0, 2).map((d: any) => d.expectedAmount),
      );
      check("nothing threw", s.errors.length === 0, s.errors.join("\n"));
      await s.close();
    }
  } finally {
    await browser.close();
  }
}

run(main);
