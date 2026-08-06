/**
 * The two things that made the import path unusable.
 *
 * An invoice that died on a thirty-minute clock while the bank was still
 * queueing it, and an importer who was never told they owed rial because every
 * notification went to the foreign seller.
 */

import { check, jar, patch, post, run, signIn } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");
  const admin = jar();
  const bank = jar();
  const seller = jar();

  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");
  await patch(admin, "/api/settings", { invoiceMinAmount: 10, usdtRate: 66800, rateTolerancePercent: 10 });

  const reg = await post(seller, "/api/auth/register", {
    fullName: "Ningbo Fixes Co.",
    email: `ningbo.fix.${Date.now()}@example.com`,
    passportNo: "CNF1",
    country: "China",
  });
  const sellerUid = reg.body?.data?.user?.uid;
  await post(admin, `/api/admin/kyc/${sellerUid}`, { action: "approve" });
  const importer = await db.user.findFirst({ where: { role: "IRANIAN", kyc: "APPROVED" } });

  console.log("── an import invoice is given a window measured in days, not minutes");
  const created = await post(seller, "/api/invoices", {
    direction: "IMPORT",
    amount: 120,
    currency: "USDT",
    description: "واردات قطعات",
    goodsTitle: "قطعات صنعتی",
    counterpartyUid: importer!.uid,
    beneficiaryWallet: "0x4d7c3f2ae8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
  });
  const inv = created.body?.data?.invoice;
  check("raised", Boolean(inv?.id), created.body);
  const row = await db.invoice.findFirst({ where: { ref: inv.id } });
  const hours = (row!.expiresAt!.getTime() - row!.createdAt.getTime()) / 3_600_000;
  check("its window is 72 hours", Math.round(hours) === 72, `${hours} hours`);

  const exportInv = await db.invoice.findFirst({ where: { direction: "EXPORT" }, orderBy: { createdAt: "desc" } });
  const exportMins = (exportInv!.expiresAt!.getTime() - exportInv!.createdAt.getTime()) / 60_000;
  check("an export still gets minutes — the buyer is paying now", exportMins <= 60, `${exportMins} minutes`);

  console.log("── the bank takes 45 minutes to get to it, as banks do");
  await post(admin, `/api/invoices/${inv.id}/transition`, { action: "approve" });
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  await db.invoice.update({
    where: { id: row!.id },
    // Where the old thirty-minute clock would already have run out.
    data: { createdAt: new Date(Date.now() - 45 * 60_000) },
  });
  await runWatcher();
  const survived = await db.invoice.findUnique({ where: { id: row!.id } });
  check("the invoice is still alive", survived?.status === "APPROVED", survived?.status);

  console.log("── the bank prices it, and the importer is the one told to pay");
  const before = await db.notification.count();
  const locked = await post(bank, `/api/invoices/${inv.id}/transition`, {
    action: "lockRate",
    rate: 70000,
    depositAccount: "IR84-0170-0000-0011-2233-44",
  });
  check("rate locked", locked.body?.data?.invoice?.status === "BANK_RATE_LOCKED", locked.body);

  const notes = await db.notification.findMany({
    where: { kind: "INVOICE_RATE_LOCKED", body: { contains: inv.id } },
    include: { user: true },
  });
  check("exactly one party was told", notes.length === 1, notes.map((n) => n.user.role));
  check("and it is the importer, not the seller", notes[0]?.user.role === "IRANIAN", notes[0]?.user.role);
  check("the link goes to their own panel", notes[0]?.href === "/imports", notes[0]?.href);
  check("the message names the sum and the account", /8,?568,?000|8568000/.test(notes[0]?.body ?? "") && notes[0]!.body.includes("IR84"), notes[0]?.body);
  check("something was written at all", (await db.notification.count()) > before);

  console.log("── the rate lock restarts the clock for the importer's wire");
  const priced = await db.invoice.findUnique({ where: { id: row!.id } });
  const left = (priced!.expiresAt!.getTime() - Date.now()) / 3_600_000;
  check("they get a fresh 72 hours against the locked rate", Math.round(left) === 72, `${left} hours`);

  console.log("── and once the rial is in, nothing can expire it out from under them");
  await post(bank, `/api/invoices/${inv.id}/transition`, { action: "confirmRialDeposit", receiptNo: "TR-FIX-1" });
  await db.invoice.update({ where: { id: row!.id }, data: { expiresAt: new Date(Date.now() - 3600_000) } });
  await runWatcher();
  const afterSweep = await db.invoice.findUnique({ where: { id: row!.id } });
  check("the sweep leaves it alone", afterSweep?.status === "RIAL_RECEIVED", afterSweep?.status);

  // Paying the contract is the importer's job. The bank supplies the currency
  // outside the system and prices it; it does not make the payment.
  const byBank = await post(bank, `/api/invoices/${inv.id}/transition`, { action: "startPayment" });
  check("the bank cannot fund the contract itself", byBank.body?.ok === false, byBank.body?.error);

  const asImporter = jar();
  await signIn(asImporter, importer!.email!);
  const started = await post(asImporter, `/api/invoices/${inv.id}/transition`, { action: "startPayment" });
  check("but the importer may, past the deadline and all", started.body?.data?.invoice?.status === "PAYMENT_PENDING", started.body?.error ?? started.body?.data?.invoice?.status);

  console.log("── every notification points at a panel its recipient can open");
  const all = await db.notification.findMany({
    where: { body: { contains: inv.id } },
    include: { user: true },
  });
  const wrong = all.filter(
    (n) =>
      (n.user.role === "FOREIGN" && !n.href?.startsWith("/foreign") && !n.href?.startsWith("/pay")) ||
      (n.user.role === "IRANIAN" && (n.href?.startsWith("/foreign") || n.href?.startsWith("/admin") || n.href?.startsWith("/bank"))),
  );
  for (const n of all) console.log(`     ${n.user.role.padEnd(8)} ${String(n.href).padEnd(22)} ${n.title}`);
  check("none of them cross panels", wrong.length === 0, wrong.map((n) => `${n.user.role} → ${n.href}`));
  const reachedImporter = all.filter((n) => n.userId === importer!.id).length;
  check("the importer heard about it more than once", reachedImporter >= 2, reachedImporter);

  console.log("── an export still sends its buyer to the checkout, and its seller to /receive");
  const exporter = await db.user.findFirst({ where: { role: "IRANIAN", kyc: "APPROVED" } });
  const buyer = await db.user.findFirst({ where: { role: "FOREIGN", kyc: "APPROVED" } });
  const { nextRef } = await import("@/lib/server/refs");
  const refs = await nextRef("invoice", db);
  const exp = await db.invoice.create({
    data: {
      ref: refs.ref, trxRef: refs.trxRef, ownerId: exporter!.id, counterpartyId: buyer!.id,
      amount: "500", currency: "USDT", description: "صادرات آزمون", goodsTitle: "کالای آزمون",
      direction: "EXPORT", senderName: buyer!.fullName, feeAmount: "10", netAmount: "490",
      status: "PENDING", expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  await post(admin, `/api/invoices/${exp.ref}/transition`, { action: "approve" });
  const expNotes = await db.notification.findMany({
    where: { body: { contains: exp.ref } }, include: { user: true },
  });
  for (const n of expNotes) console.log(`     ${n.user.role.padEnd(8)} ${String(n.href).padEnd(22)} ${n.title}`);
  check("the buyer is sent to the checkout", expNotes.some((n) => n.user.role === "FOREIGN" && n.href === `/pay/${exp.ref}`), expNotes.map((n) => `${n.user.role}:${n.href}`));
  check("the merchant is sent to their own invoice", expNotes.some((n) => n.user.role === "IRANIAN" && n.href === `/receive/${exp.ref}`), expNotes.map((n) => `${n.user.role}:${n.href}`));
}

run(main);
