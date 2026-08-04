/**
 * Export now names its buyer.
 *
 * The merchant cannot raise an invoice without a registered buyer's id, the
 * invoice reaches that buyer's own dashboard, and nobody else can see it or pay
 * it — including someone holding the link.
 */

import { call, check, jar, patch, post, run, signIn, BASE, STAFF } from "./harness";

async function main() {
  const admin = jar();
  const merchant = jar();
  const buyer = jar();
  const otherBuyer = jar();

  await signIn(admin, "admin@afa.local");
  await patch(admin, "/api/settings", { invoiceMinAmount: 10, invoiceValidityMinutes: 60 });

  console.log("── the buyer registers and gets an id");
  const reg = await post(buyer, "/api/auth/register", {
    fullName: "Anatolia Imports Ltd",
    email: `anatolia.${Date.now()}@example.com`,
    passportNo: "TR55",
    country: "Türkiye",
  });
  const buyerUid = reg.body?.data?.user?.uid;
  check("buyer registered with a uid", /^FOR-\d+$/.test(buyerUid ?? ""), reg.body);

  await post(otherBuyer, "/api/auth/register", {
    fullName: "Someone Else",
    email: `other.${Date.now()}@example.com`,
    passportNo: "XX1",
    country: "China",
  });

  console.log("── merchant signs in");
  await signIn(merchant, STAFF.merchant);

  console.log("── an invoice cannot be raised against a name");
  const noBuyer = await post(merchant, "/api/invoices", {
    amount: 1000,
    currency: "USDT",
    description: "صادرات فرش",
    goodsTitle: "فرش دستباف",
    counterpartyUid: "Anatolia Imports",
  });
  check(
    "an unregistered buyer is refused",
    noBuyer.body?.ok === false && JSON.stringify(noBuyer.body).includes("ثبت‌نام"),
    noBuyer.body?.error,
  );

  const missing = await post(merchant, "/api/invoices", {
    amount: 1000,
    currency: "USDT",
    description: "x",
    goodsTitle: "y",
  });
  check(
    "and omitting the buyer entirely is refused",
    missing.body?.ok === false && JSON.stringify(missing.body).includes("counterpartyUid"),
    missing.body?.error,
  );

  console.log("── with a real buyer id it works");
  const created = await post(merchant, "/api/invoices", {
    amount: 1000,
    currency: "USDT",
    description: "صادرات فرش دستباف",
    goodsTitle: "فرش ۹ متری",
    counterpartyUid: buyerUid,
  });
  const invoice = created.body?.data?.invoice;
  const ref = invoice?.id;
  check("invoice created", Boolean(ref), created.body);
  check("it names the buyer", invoice?.counterpartyUid === buyerUid, invoice?.counterpartyUid);
  check(
    "and takes their name from the account, not a text box",
    invoice?.counterpartyName === "Anatolia Imports Ltd",
    invoice?.counterpartyName,
  );

  console.log("── the invoice reaches the buyer's own dashboard");
  const theirs = await call(buyer, "/api/invoices?status=ALL");
  check("the buyer sees it", (theirs.body?.data?.list ?? []).some((i: any) => i.id === ref), theirs.body?.data?.list?.length);

  const notTheirs = await call(otherBuyer, "/api/invoices?status=ALL");
  check(
    "another buyer does not",
    !(notTheirs.body?.data?.list ?? []).some((i: any) => i.id === ref),
    notTheirs.body?.data?.list,
  );

  console.log("── and their own notification says so");
  const notes = await call(buyer, "/api/notifications");
  check(
    "the buyer was told",
    (notes.body?.data?.list ?? []).some((n: any) => n.kind === "INVOICE_ADDRESSED"),
    notes.body?.data?.list?.map((n: any) => n.kind),
  );

  // Who may open a checkout depends on whether the deployment has a sign-in at
  // all. Both rules are worth holding: the locked one is what production wants,
  // and the open one is what the link-only mode promises.
  const openAccess = process.env.AUTH_OPEN_ACCESS === "true";
  console.log(
    openAccess
      ? "── with open access, the payment link works for whoever holds it"
      : "── the payment page is not open to whoever holds the link",
  );
  await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });

  const anonymous = await fetch(`${BASE}/pay/${ref}`, { redirect: "manual" });
  const anonymousHtml = await anonymous.text();
  const wrongAccount = await fetch(`${BASE}/pay/${ref}`, {
    headers: { cookie: otherBuyer.cookie },
    redirect: "manual",
  });
  const wrongHtml = await wrongAccount.text();

  if (openAccess) {
    check("a stranger sees the request", anonymousHtml.includes("Amount due"), anonymous.status);
    check("and so does anyone else signed in", wrongHtml.includes("Amount due"));
  } else {
    check("a stranger is asked to sign in", anonymousHtml.includes("Sign in to view"), anonymous.status);
    check("and is not shown the amount", !anonymousHtml.includes("Amount due"));
    check("the wrong buyer is asked to sign in too", wrongHtml.includes("Sign in to view"));
  }

  const right = await fetch(`${BASE}/pay/${ref}`, { headers: { cookie: buyer.cookie } });
  const rightHtml = await right.text();
  check("the addressed buyer sees the request", rightHtml.includes("Amount due"), right.status);
  check("with the address to pay", rightHtml.includes(invoice.paymentAddress ?? "__none__"));

  console.log("── nobody else can pay it");
  const stolen = await post(otherBuyer, `/api/invoices/${ref}/transition`, {
    action: "startPayment",
  });
  check("another account cannot start the payment", stolen.status === 403, stolen.body?.error);

  const anon = await post(jar(), `/api/invoices/${ref}/transition`, { action: "startPayment" });
  check("and an anonymous caller cannot either", anon.status === 401, anon.status);

  const mine = await post(buyer, `/api/invoices/${ref}/transition`, { action: "startPayment" });
  check("the addressed buyer can", mine.body?.data?.invoice?.status === "PAYMENT_PENDING", mine.body);

  console.log("── the merchant still sees their own invoice");
  const merchantView = await call(merchant, "/api/invoices?status=ALL");
  check(
    "it is in their list",
    (merchantView.body?.data?.list ?? []).some((i: any) => i.id === ref),
  );
  const detail = await call(merchant, `/api/invoices/${ref}`);
  check("and they can open it", detail.body?.ok === true, detail.body?.error);
}

run(main);
