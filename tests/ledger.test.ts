/**
 * The books: does every movement of money land in an account, do the fee shares
 * add back to the fee, and can the gateway say what it owes and what it earned?
 */

import { call, check, jar, patch, post, run, signIn, STAFF } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");
  const { Prisma } = await import("@/lib/generated/prisma/client");
  const { splitGatewayFee, bankSpread } = await import("@/lib/server/ledger");

  const admin = jar();
  const bank = jar();
  const merchant = jar();

  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");

  console.log("── settings this run depends on");
  const st = await patch(admin, "/api/settings", {
    feeBasePercent: 2,
    feeMin: 1,
    feeMax: 500,
    usdtRate: 66800,
    rateTolerancePercent: 10,
    freezoneSharePercent: 40,
  });
  check("organisation share is configurable", st.body?.data?.settings?.freezoneSharePercent === 40, st.body?.data?.settings);

  console.log("── the split is exact, with rounding kept by the gateway");
  const split = splitGatewayFee("20", 40);
  check("40% of a 20 fee is 8 to the organisation", split.freezone.toFixed(2) === "8.00", split.freezone.toString());
  check("the two shares add back to the fee", split.gateway.plus(split.freezone).toFixed(8) === new Prisma.Decimal(20).toFixed(8), {
    gateway: split.gateway.toString(),
    freezone: split.freezone.toString(),
  });
  const odd = splitGatewayFee("0.000000015", 33.333);
  check("an awkward split still adds back exactly", odd.gateway.plus(odd.freezone).toFixed(9) === "0.000000015", {
    gateway: odd.gateway.toString(),
    freezone: odd.freezone.toString(),
  });

  console.log("── the bank's margin has a sign that follows the direction");
  const selling = bankSpread({ side: "sell", lockedRate: 72000, referenceRate: 66800, tokenAmount: 100 });
  const buying = bankSpread({ side: "buy", lockedRate: 62000, referenceRate: 66800, tokenAmount: 100 });
  check("selling above the reference earns", selling.toString() === "520000", selling.toString());
  check("buying below the reference earns", buying.toString() === "480000", buying.toString());

  console.log("── a paid invoice writes the books");
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

  const before = await db.ledgerEntry.count();
  const inv = await post(merchant, "/api/invoices", {
    amount: 1000,
    currency: "USDT",
    description: "دفتر کل",
    goodsTitle: "کالای آزمون",
    counterpartyUid: buyerUid,
  });
  const ref = inv.body?.data?.invoice?.id;
  await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });

  const row = await db.invoice.findFirst({ where: { ref }, include: { depositAddress: true } });
  const runTag = Date.now().toString(16).padStart(12, "0");
  await db.chainTx.create({
    data: {
      hash: `0x${runTag}${"c".repeat(64 - runTag.length)}`,
      chainId: Number(process.env.CHAIN_ID ?? 56),
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: "0x" + "2".repeat(40),
      toAddress: row!.paymentAddress!,
      currency: "USDT",
      amount: "1000",
      rawValue: "1000",
      blockNumber: 3n,
      confirmations: 50,
    },
  });
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  await runWatcher();

  const entries = await db.ledgerEntry.findMany({
    where: { subjectRef: ref },
    orderBy: { account: "asc" },
  });
  check("entries were written", entries.length > before - before, { count: entries.length });
  const by = (a: string) => entries.find((e) => e.account === a);
  check("the deposit is held at the address", by("DEPOSIT_HELD")?.amount.toString() === "1000", by("DEPOSIT_HELD")?.amount?.toString());
  check("the merchant is owed 980", by("MERCHANT_PAYABLE")?.amount.toString() === "980", by("MERCHANT_PAYABLE")?.amount?.toString());
  // The settings row says 40% to the organisation; the deployed contract says
  // 50% and is what will actually pay the two wallets. The books follow the
  // contract, so the panel setting only decides what a future contract gets.
  check("the gateway keeps 10 of the 20 fee — the contract's split, not the panel's", by("GATEWAY_SHARE")?.amount.toString() === "10", by("GATEWAY_SHARE")?.amount?.toString());
  check("the organisation gets 10, though the panel says 40%", by("FREEZONE_SHARE")?.amount.toString() === "10", by("FREEZONE_SHARE")?.amount?.toString());
  check(
    "the claims add up to what arrived",
    Number(by("MERCHANT_PAYABLE")?.amount) + Number(by("GATEWAY_SHARE")?.amount) + Number(by("FREEZONE_SHARE")?.amount) ===
      Number(by("DEPOSIT_HELD")?.amount),
  );
  check("the merchant's claim is attributed to them", Boolean(by("MERCHANT_PAYABLE")?.userId));

  console.log("── running the watcher again does not double the books");
  await runWatcher();
  const again = await db.ledgerEntry.count({ where: { subjectRef: ref, kind: "INVOICE_PAID" } });
  check("still one set of entries", again === entries.length, { now: again, was: entries.length });

  console.log("── the position is answerable");
  const view = await call(admin, "/api/ledger");
  const balances: any[] = view.body?.data?.balances ?? [];
  const find = (a: string) => balances.find((b) => b.account === a);
  check("admin can read the position", view.body?.ok === true, view.body?.error);
  check("it reports what is owed to merchants", Number(find("MERCHANT_PAYABLE")?.amount) >= 980, find("MERCHANT_PAYABLE"));
  check("it reports the organisation's share", Number(find("FREEZONE_SHARE")?.amount) >= 8, find("FREEZONE_SHARE"));

  console.log("── a merchant cannot read the gateway's books");
  const denied = await call(merchant, "/api/ledger");
  check("merchant refused", denied.status === 403, denied.status);
  const anon = await call(jar(), "/api/ledger");
  check("anonymous refused", anon.status === 401, anon.status);

  console.log("── the payout discharges the debt when the bank pays rial");
  const payout = await db.settlement.findUnique({ where: { sourceInvoiceId: row!.id } });
  await post(merchant, `/api/settlements/${payout!.ref}/transition`, {
    action: "setPayoutAccount",
    payoutAccount: "IR84-0170-0000-0011-2233-44",
  });
  const locked = await post(bank, `/api/settlements/${payout!.ref}/transition`, {
    action: "lockRate",
    rate: 62000,
  });
  check("the bank's margin is recorded at lock time", Number(locked.body?.data?.settlement?.bankSpreadRial) > 0, locked.body?.data?.settlement);

  await post(bank, `/api/settlements/${payout!.ref}/transition`, {
    action: "settle",
    receiptNo: "TR-LEDGER-1",
  });

  const settledEntries = await db.ledgerEntry.findMany({ where: { subjectRef: payout!.ref } });
  const payable = settledEntries.find((e) => e.account === "MERCHANT_PAYABLE");
  const spread = settledEntries.find((e) => e.account === "BANK_SPREAD");
  check("the merchant's claim is cleared", payable?.amount.toString() === "-980", payable?.amount?.toString());
  check("the bank's margin is in rial", spread?.unit === "IRR" && Number(spread?.amount) > 0, {
    unit: spread?.unit,
    amount: spread?.amount?.toString(),
  });

  // Scoped to this journey's two records: the merchant's overall balance also
  // carries every other invoice in the database, which is not what is under test.
  const owed = await db.ledgerEntry.aggregate({
    where: {
      account: "MERCHANT_PAYABLE",
      userId: payout!.ownerId,
      subjectRef: { in: [ref, payout!.ref] },
    },
    _sum: { amount: true },
  });
  check(
    "the claim raised by the invoice and cleared by the payout nets to zero",
    Number(owed._sum.amount) === 0,
    owed._sum.amount?.toString(),
  );
}

run(main);
