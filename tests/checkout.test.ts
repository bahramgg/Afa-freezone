/**
 * The receive flow as a gateway: a unique address per invoice, a public
 * checkout the buyer can actually open, exact matching, partial and over
 * payment, and automatic expiry.
 */

import { check, jar, post, run, signIn, BASE, STAFF } from "./harness";

async function main() {
  // Unique per run, so a rerun does not collide with the previous one.
  const runTag = Date.now().toString(16).padStart(12, "0");
  const { db } = await import("@/lib/server/db");
  const admin = jar();
  const merchant = jar();

  await signIn(admin, "admin@afa.local");

  await signIn(merchant, STAFF.merchant);
  // Invoices are now addressed to a registered buyer, so every suite needs one.
  const buyerJar = jar();
  const buyerReg = await post(buyerJar, "/api/auth/register", {
    fullName: "Suite Buyer",
    email: `suite.buyer.${Date.now()}@example.com`,
    passportNo: "SB1",
    country: "China",
  });
  const buyerUid = buyerReg.body?.data?.user?.uid;

  console.log("── two invoices, same merchant, same moment");
  const refs: string[] = [];
  for (const amount of [500, 1000]) {
    const r = await post(merchant, "/api/invoices", {
      amount,
      currency: "USDT",
      description: `آزمون ${amount}`,
      goodsTitle: `کالای ${amount}`,
    counterpartyUid: buyerUid,
    });
    const ref = r.body?.data?.invoice?.id;
    refs.push(ref);
    await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
  }

  const rows = await db.invoice.findMany({
    where: { ref: { in: refs } },
    include: { depositAddress: true },
    orderBy: { amount: "asc" },
  });
  const [small, large] = rows;

  console.log("── each invoice gets its own derived address");
  check("both have an address", Boolean(small.paymentAddress && large.paymentAddress));
  check("the addresses differ", small.paymentAddress !== large.paymentAddress, {
    small: small.paymentAddress,
    large: large.paymentAddress,
  });
  check("each is recorded at its own index", small.depositAddress!.index !== large.depositAddress!.index, {
    a: small.depositAddress?.index,
    b: large.depositAddress?.index,
  });
  check(
    "no address is a bank wallet",
    (await db.wallet.count({ where: { address: { in: [small.paymentAddress!, large.paymentAddress!] } } })) === 0,
  );

  console.log("── a payment can only settle the invoice it was sent to");
  // Exactly the lookup the watcher now performs.
  const owner = await db.depositAddress.findUnique({
    where: { address: large.paymentAddress! },
    include: { invoice: true },
  });
  check("1000 sent to the large invoice's address settles that invoice", owner?.invoice?.ref === large.ref, {
    credited: owner?.invoice?.ref,
    expected: large.ref,
  });

  // Locked, the checkout belongs to the buyer it names; open, the link is the
  // credential. Both are intended behaviour — which one applies is the flag.
  const openAccess = process.env.AUTH_OPEN_ACCESS === "true";
  console.log(
    openAccess
      ? "── with open access, the checkout opens for whoever holds the link"
      : "── the checkout page belongs to the buyer it was addressed to",
  );
  const anon = await fetch(`${BASE}/pay/${large.ref}`);
  const anonHtml = await anon.text();
  if (openAccess) {
    check("a stranger sees it", anonHtml.includes("Amount due"), anon.status);
  } else {
    check("a stranger is asked to sign in", anonHtml.includes("Sign in to view"), anon.status);
    check("and is shown no amount", !anonHtml.includes("Amount due"));
  }

  const mine = await fetch(`${BASE}/pay/${large.ref}`, { headers: { cookie: buyerJar.cookie } });
  const html = await mine.text();
  check("the addressed buyer sees it", mine.status === 200 && html.includes("Amount due"), mine.status);
  check("it shows this invoice's own address", html.includes(large.paymentAddress!), "address missing");
  check("it offers wallet payment", html.includes("Pay with a browser wallet"));
  check("it does not leak our RPC endpoint", !html.includes("quiknode") && !html.includes("alch_"));

  console.log("── partial payment leaves the invoice open on the same address");
  await db.chainTx.create({
    data: {
      hash: `0x${runTag}a${"0".repeat(64 - runTag.length - 1)}`,
      chainId: Number(process.env.CHAIN_ID ?? 56),
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: "0x" + "1".repeat(40),
      toAddress: large.paymentAddress!,
      currency: "USDT",
      amount: "400",
      rawValue: "400",
      blockNumber: 1n,
      confirmations: 99,
    },
  });
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  await runWatcher();
  let after = await db.invoice.findUnique({ where: { id: large.id } });
  check("still open after a short payment", after?.status === "PAYMENT_PENDING", after?.status);
  check("what arrived is recorded", Number(after?.receivedAmount) === 400, after?.receivedAmount);

  console.log("── the rest, to the same address, completes it");
  await db.chainTx.create({
    data: {
      hash: `0x${runTag}b${"0".repeat(64 - runTag.length - 1)}`,
      chainId: Number(process.env.CHAIN_ID ?? 56),
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: "0x" + "1".repeat(40),
      toAddress: large.paymentAddress!,
      currency: "USDT",
      amount: "700",
      rawValue: "700",
      blockNumber: 2n,
      confirmations: 98,
    },
  });
  await runWatcher();
  after = await db.invoice.findUnique({ where: { id: large.id } });
  check("paid once the total covers it", after?.status === "PAID", after?.status);
  check("credited for what actually arrived (1100)", Number(after?.receivedAmount) === 1100, after?.receivedAmount);
  check(
    "the fee follows the received amount, not the invoiced one",
    Number(after?.feeAmount) === 22,
    after?.feeAmount,
  );
  check("the overpayment reaches the merchant", Number(after?.netAmount) === 1078, after?.netAmount);

  const payout = await db.settlement.findUnique({ where: { sourceInvoiceId: large.id } });
  check("a payout was raised for the full received net", Number(payout?.amount) === 1078, payout?.amount);

  console.log("── the small invoice was never touched");
  const untouched = await db.invoice.findUnique({ where: { id: small.id } });
  check("still awaiting its own payment", untouched?.status === "APPROVED", untouched?.status);

  console.log("── expiry closes an unpaid invoice on its own");
  await db.invoice.update({
    where: { id: small.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const report = await runWatcher();
  const expired = await db.invoice.findUnique({ where: { id: small.id } });
  check("expired automatically", expired?.status === "EXPIRED", expired?.status);
  check("the watcher reports it", report.invoicesExpired >= 1, report.invoicesExpired);
  const paidStill = await db.invoice.findUnique({ where: { id: large.id } });
  check("a paid invoice is not expired by the sweep", paidStill?.status === "PAID", paidStill?.status);
}

run(main);
