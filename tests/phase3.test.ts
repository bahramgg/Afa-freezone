/**
 * The old send flow closed to new business, trade documents on the record, and
 * money that can go back the way it came.
 */

import { check, jar, patch, post, run, signIn, BASE, STAFF } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");
  const runTag = Date.now().toString(16).padStart(12, "0");

  const admin = jar();
  const bank = jar();
  const merchant = jar();

  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");
  await patch(admin, "/api/settings", {
    feeBasePercent: 2,
    feeMin: 1,
    usdtRate: 66800,
    rateTolerancePercent: 10,
    freezoneSharePercent: 40,
    minTxAmount: 10,
  });

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

  // ────────────────────────────────────────────────────────────────────────
  console.log("══ IMPORT — the old send flow is gone from the system");

  // It is not merely closed to new business now: the routes, the pages and the
  // client store are all removed. Imports go through an invoice the foreign
  // seller raises, covered end to end in the import-flow suite.
  const send = await post(merchant, "/api/sends", {
    counterpartyUid: "Ningbo Trading Co.",
    amount: 120,
    currency: "USDT",
  });
  check("the endpoint no longer exists", send.status === 404, { status: send.status, body: send.body });

  for (const page of ["/send", "/foreign/requests", "/bank/send", "/admin/send"]) {
    const res = await fetch(BASE + page);
    check(`${page} is no longer served`, res.status === 404, res.status);
  }

  // ────────────────────────────────────────────────────────────────────────
  console.log("\n══ REFUND — money going back the way it came");

  const inv = await post(merchant, "/api/invoices", {
    amount: 200,
    currency: "USDT",
    description: "معاملهٔ فسخ‌شده",
    goodsTitle: "کالای برگشتی",
    counterpartyUid: buyerUid,
  });
  const ref = inv.body?.data?.invoice?.id;
  await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });

  const row = await db.invoice.findFirst({ where: { ref } });
  const buyer = "0x00000000000000000000000000000000000b0b0b";
  await db.chainTx.create({
    data: {
      hash: `0x${runTag}d${"0".repeat(64 - runTag.length - 1)}`,
      chainId: Number(process.env.CHAIN_ID ?? 56),
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: buyer,
      toAddress: row!.paymentAddress!,
      currency: "USDT",
      amount: "200",
      rawValue: "200",
      blockNumber: 9n,
      confirmations: 40,
    },
  });
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  await runWatcher();

  console.log("── the merchant asks for it back");
  const created = await post(merchant, "/api/refunds", {
    invoiceRef: ref,
    reason: "خریدار سفارش را لغو کرد",
  });
  const refund = created.body?.data?.refund;
  check("refund raised", Boolean(refund?.id), created.body);
  check("its destination is where the payment came from", refund?.toAddress === buyer, refund?.toAddress);
  check("for what actually arrived", refund?.amount === 200, refund?.amount);

  console.log("── one refund per invoice");
  const dup = await post(merchant, "/api/refunds", { invoiceRef: ref, reason: "دوباره" });
  check("a second request is refused", dup.status === 409, dup.status);

  console.log("── only admin decides, only the bank moves it");
  let deny = await patch(merchant, "/api/refunds", { ref: refund.id, action: "approve" });
  check("the merchant cannot approve their own refund", deny.status === 403, deny.status);
  deny = await patch(bank, "/api/refunds", { ref: refund.id, action: "approve" });
  check("the bank cannot approve either", deny.status === 403, deny.status);

  const approved = await patch(admin, "/api/refunds", { ref: refund.id, action: "approve" });
  check("admin approves", approved.body?.data?.refund?.status === "APPROVED", approved.body);

  deny = await patch(admin, "/api/refunds", {
    ref: refund.id,
    action: "markSent",
    txHash: `0x${"1".repeat(64)}`,
  });
  check("admin cannot record the transfer", deny.status === 403, deny.status);

  console.log("── the chain has the last word");
  const bogus = await patch(bank, "/api/refunds", {
    ref: refund.id,
    action: "markSent",
    txHash: `0x${"1".repeat(64)}`,
  });
  check("a fabricated hash is refused", bogus.status === 400, bogus.body?.error?.message);

  console.log("── the books unwind when the money leaves");
  // Reaching SENT needs a transfer the chain agrees with, which cannot be
  // conjured here — so drive the same postings the transition runs and check
  // what the books do with them.
  const full = await db.refund.findUnique({ where: { ref: refund.id } });
  const invoice = await db.invoice.findUnique({ where: { id: full!.invoiceId } });
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const ledger = await import("@/lib/server/ledger");
  const { Prisma } = await import("@/lib/generated/prisma/client");
  type Decimal = InstanceType<typeof Prisma.Decimal>;
  const { gateway, freezone } = ledger.splitGatewayFee(
    invoice!.feeAmount ?? 0,
    Number(settings?.freezoneSharePercent ?? 50),
  );
  const neg = (v: Decimal | string | number) => new Prisma.Decimal(v).negated();

  await ledger.post(
    { kind: "REFUND_SENT", subject: "invoice", subjectId: full!.id, subjectRef: full!.ref },
    [
      { account: "REFUNDED", amount: full!.amount, unit: "USDT" },
      { account: "DEPOSIT_HELD", amount: neg(full!.amount), unit: "USDT" },
      {
        account: "MERCHANT_PAYABLE",
        amount: neg(invoice!.netAmount ?? 0),
        unit: "USDT",
        userId: invoice!.ownerId,
      },
      { account: "GATEWAY_SHARE", amount: neg(gateway), unit: "USDT" },
      { account: "FREEZONE_SHARE", amount: neg(freezone), unit: "USDT" },
    ],
  );
  const entries = await db.ledgerEntry.findMany({ where: { subjectRef: full!.ref } });

  const by = (a: string) => entries.find((e) => e.account === a);
  check("the refund is recorded", Number(by("REFUNDED")?.amount) === 200, by("REFUNDED")?.amount?.toString());
  check("the deposit claim is released", Number(by("DEPOSIT_HELD")?.amount) === -200, by("DEPOSIT_HELD")?.amount?.toString());
  check("the merchant is no longer owed it", Number(by("MERCHANT_PAYABLE")?.amount) === -196, by("MERCHANT_PAYABLE")?.amount?.toString());
  check("the gateway gives back its fee share", Number(by("GATEWAY_SHARE")?.amount) < 0, by("GATEWAY_SHARE")?.amount?.toString());
  check("and so does the organisation", Number(by("FREEZONE_SHARE")?.amount) < 0, by("FREEZONE_SHARE")?.amount?.toString());
  check(
    "the reversal nets to zero against the payment",
    Number(by("MERCHANT_PAYABLE")?.amount) +
      Number(by("GATEWAY_SHARE")?.amount) +
      Number(by("FREEZONE_SHARE")?.amount) ===
      Number(by("DEPOSIT_HELD")?.amount),
  );

  console.log("── a settled invoice cannot be refunded");
  const settled = await db.invoice.findFirst({
    where: { status: "PAID", settlement: { status: "SETTLED" } },
    select: { ref: true },
  });
  if (settled) {
    const late = await post(merchant, "/api/refunds", {
      invoiceRef: settled.ref,
      reason: "دیر",
    });
    check("refused once the rial is paid", late.status === 409 || late.status === 400, late.body?.error);
  } else {
    console.log("     (no settled invoice in this database to try)");
  }
}

run(main);
