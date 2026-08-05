/**
 * An invoice whose payment is still settling is not an abandoned invoice.
 *
 * On a chain that finalises in seconds this window is invisible. On Ethereum it
 * is not: Sepolia's finalised head runs about eighteen minutes behind, which is
 * most of an invoice's validity. A buyer who paid at minute twenty watched the
 * request expire at minute thirty and turn back into "paid" at minute thirty
 * eight — the money was never at risk, but the invoice announced two
 * contradictory things in a row, and the second one arrived too late to stop
 * anyone acting on the first.
 *
 * Finality is simulated by asking for more confirmations than the chain has
 * produced, which is the same state a slow chain leaves a fresh transfer in.
 */
import { check, ensureMerchant, get, jar, post, run, signIn, STAFF, unique } from "./harness";

/**
 * Set before anything reads it: `env()` caches on first call, so a suite that
 * changes the chain's parameters has to do it before the first import that
 * touches them.
 */
process.env.CHAIN_FINALITY = "confirmations";
process.env.CHAIN_MIN_CONFIRMATIONS = "6";

async function main() {
  const { db } = await import("@/lib/server/db");
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  const { chain } = await import("./harness");
  const c = await chain();

  await ensureMerchant();

  const admin = jar();
  const merchant = jar();
  const buyer = jar();
  await signIn(admin, STAFF.admin);
  await signIn(merchant, STAFF.merchant);

  // A buyer to raise the invoice against — an export names the party paying.
  const buyerEmail = unique("settling") + "@example.com";
  const reg = await post(buyer, "/api/auth/register", {
    fullName: "Settling Buyer Ltd",
    email: buyerEmail,
    passportNo: "SL1",
    country: "Türkiye",
  });
  const buyerUid = reg.body?.data?.user?.uid;
  check("a buyer exists to raise the invoice against", !!buyerUid, reg.body);

  console.log("── an invoice, approved, with an address to pay");
  const created = await post(merchant, "/api/invoices", {
    amount: 100,
    currency: "USDT",
    description: `پرداخت در حال قطعی‌شدن ${unique("t")}`,
    goodsTitle: "کالای آزمایشی",
    counterpartyUid: buyerUid,
  });
  const ref = created.body?.data?.invoice?.id;
  check("invoice created", !!ref, created.body);

  const approved = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
  const address = approved.body?.data?.invoice?.paymentAddress;
  check("and it was quoted an address", /^0x[0-9a-f]{40}$/.test(address ?? ""), approved.body);

  console.log("── the buyer pays, and the transfer has not finalised yet");
  await c.mint(c.operator.address, "100");
  await c.transfer(address, "100");
  await runWatcher();

  const seen = await db.invoice.findUnique({ where: { ref } });
  check("the deposit is on chain but not yet irreversible", Number(seen?.pendingAmount) === 100, {
    pending: seen?.pendingAmount?.toString(),
  });
  check("nothing has been credited yet — that figure is for confirmed money only",
    seen?.receivedAmount == null || Number(seen.receivedAmount) === 0,
    seen?.receivedAmount?.toString());
  check("and the invoice has not been marked paid", seen?.status === "APPROVED", seen?.status);

  console.log("── the buyer can see their money arrived");
  const view = await get(buyer, `/api/invoices/${ref}`);
  check("the payment page reports it as pending", view.body?.data?.invoice?.pendingAmount === 100, {
    pendingAmount: view.body?.data?.invoice?.pendingAmount,
  });

  console.log("── the window runs out while the transfer is still settling");
  await db.invoice.update({
    where: { ref },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await runWatcher();

  const held = await db.invoice.findUnique({ where: { ref } });
  // The check this suite exists for. Against the old behaviour the invoice is
  // EXPIRED here, and turns back into PAID a few minutes later.
  check("the invoice is held open, not expired", held?.status === "APPROVED", held?.status);

  console.log("── an invoice with nothing on the way still expires");
  const empty = await post(merchant, "/api/invoices", {
    amount: 50,
    currency: "USDT",
    description: `بدون پرداخت ${unique("t")}`,
    goodsTitle: "کالای آزمایشی",
    counterpartyUid: buyerUid,
  });
  const emptyRef = empty.body?.data?.invoice?.id;
  await post(admin, `/api/invoices/${emptyRef}/transition`, { action: "approve" });
  await db.invoice.update({
    where: { ref: emptyRef },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await runWatcher();
  const abandoned = await db.invoice.findUnique({ where: { ref: emptyRef } });
  check("the grace did not stop ordinary expiry", abandoned?.status === "EXPIRED", abandoned?.status);

  console.log("── the transfer finalises");
  // Six more blocks to clear the confirmation threshold, then `settle` mines one
  // more and waits out viem's block-number cache before running the watcher —
  // without that wait the watcher reads a stale head and sees nothing new.
  for (let i = 0; i < 6; i++) {
    await c.publicClient.waitForTransactionReceipt({
      hash: await c.wallet.sendTransaction({ to: c.operator.address, value: 0n }),
    });
  }
  await c.settle();

  const paid = await db.invoice.findUnique({ where: { ref } });
  check("the invoice settles on its own", paid?.status === "PAID", paid?.status);
  check("and is credited the confirmed amount", Number(paid?.receivedAmount) === 100, {
    received: paid?.receivedAmount?.toString(),
  });
  check("with nothing left recorded as in flight", Number(paid?.pendingAmount) === 0, {
    pending: paid?.pendingAmount?.toString(),
  });

  console.log("── a sighting that never finalises stops holding the invoice open");
  await db.invoice.update({
    where: { ref: emptyRef },
    data: {
      status: "APPROVED",
      pendingAmount: 10,
      // Expired more than the grace period ago: money that has been "on the
      // way" for a day is not on the way.
      expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    },
  });
  await runWatcher();
  const stuck = await db.invoice.findUnique({ where: { ref: emptyRef } });
  check("a day-old sighting no longer defers expiry", stuck?.status === "EXPIRED", stuck?.status);
}

run(main);
