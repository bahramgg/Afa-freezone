import { check, db, get, jar, post, run, runId, signIn, STAFF, step, unique } from "./harness";

/**
 * Calling an import off, once the bank is holding the importer's rial.
 *
 * This is the only point in the system where money can be stranded. The
 * importer has paid, the currency has not gone out, and until now nothing could
 * move: `reject` and `expire` both stop at APPROVED, and the refund route keys
 * on the invoice owner — who, on an import, is the foreign seller rather than
 * the importer whose money is at the bank.
 *
 * So what is checked here is not that a button works. It is that there is a way
 * out at all, that it cannot be taken by somebody who does not know whether the
 * currency has already left, and that it cannot quietly close over an unpaid
 * debt.
 */
async function main() {
  const admin = jar();
  const bank = jar();
  const seller = jar();
  const importer = jar();

  await signIn(admin, STAFF.admin);
  await signIn(bank, STAFF.bank);
  await signIn(importer, STAFF.merchant);
  const importerUid = (await get(importer, "/api/auth/me")).body?.data?.user?.uid;

  const sellerEmail = `${unique("cancel.seller")}@afa.local`;
  const reg = await post(seller, "/api/auth/register", {
    fullName: "Cancel Test Seller",
    email: sellerEmail,
    passportNo: "CNC1",
    country: "China",
  });
  await post(admin, `/api/admin/kyc/${reg.body?.data?.user?.uid}`, { action: "approve" });

  /** Raises an import and walks it as far as the caller asks. */
  async function anImport(upTo: "APPROVED" | "BANK_RATE_LOCKED" | "RIAL_RECEIVED") {
    const created = await post(seller, "/api/invoices", {
      direction: "IMPORT",
      amount: 100,
      currency: "USDT",
      description: `لغو واردات ${runId}`,
      goodsTitle: "کالای آزمون",
      counterpartyUid: importerUid,
      beneficiaryWallet: "0x4d7c3f2ae8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
    });
    const ref = created.body?.data?.invoice?.id;
    await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    if (upTo === "APPROVED") return ref;

    await post(bank, `/api/invoices/${ref}/transition`, {
      action: "lockRate",
      rate: 70000,
      depositAccount: "IR84-0170-0000-0011-2233-44",
    });
    if (upTo === "BANK_RATE_LOCKED") return ref;

    await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo: "TR-CANCEL-IN",
    });
    return ref;
  }

  // ────────────────────────────────────────────────────────────────────────
  step("the importer can say the deal is dead, and it reaches the bank");
  const stranded = await anImport("RIAL_RECEIVED");
  {
    const asked = await post(importer, `/api/invoices/${stranded}/transition`, {
      action: "requestCancel",
      reason: "فروشنده بار را ارسال نکرد",
    });
    check("the request is accepted", asked.body?.ok === true, asked.body?.error);

    const row = await db.invoice.findFirst({ where: { ref: stranded } });
    check("it is recorded against the invoice", Boolean(row?.cancelRequestedAt), row?.cancelRequestedAt);
    check("with the reason", row?.cancelReason?.includes("ارسال نکرد") === true, row?.cancelReason);
    check(
      "and the status has not moved — asking is not deciding",
      row?.status === "RIAL_RECEIVED",
      row?.status,
    );

    const again = await post(importer, `/api/invoices/${stranded}/transition`, {
      action: "requestCancel",
      reason: "دوباره",
    });
    check("asking twice is refused", again.body?.ok === false, again.body);
  }

  step("a trader cannot call it off themselves — only the bank knows if the currency left");
  {
    const byImporter = await post(importer, `/api/invoices/${stranded}/transition`, {
      action: "cancel",
      reason: "خودم لغو می‌کنم",
    });
    check("the importer is refused", byImporter.status === 403, byImporter.status);

    const bySeller = await post(seller, `/api/invoices/${stranded}/transition`, {
      action: "cancel",
      reason: "خودم لغو می‌کنم",
    });
    check("the seller is refused", bySeller.status === 403, bySeller.status);

    const stillOpen = await db.invoice.findFirst({ where: { ref: stranded } });
    check("nothing moved", stillOpen?.status === "RIAL_RECEIVED", stillOpen?.status);
  }

  step("cancelling after the rial arrived does not close the file");
  {
    const cancelled = await post(bank, `/api/invoices/${stranded}/transition`, {
      action: "cancel",
      reason: "فروشنده بار را ارسال نکرد",
    });
    check("the bank can cancel", cancelled.body?.ok === true, cancelled.body?.error);
    check(
      "it lands on CANCELLING, not CANCELLED — the rial is still owed",
      cancelled.body?.data?.invoice?.status === "CANCELLING",
      cancelled.body?.data?.invoice?.status,
    );

    const row = await db.invoice.findFirst({ where: { ref: stranded } });
    check("nothing claims the rial went back yet", row?.rialReturnedAt === null, row?.rialReturnedAt);
  }

  step("only the bank can say the rial went back, and only with a receipt");
  {
    const byAdmin = await post(admin, `/api/invoices/${stranded}/transition`, {
      action: "confirmRialReturn",
      receiptNo: "TR-X",
    });
    check("the organisation cannot claim it", byAdmin.status === 403, byAdmin.status);

    const noReceipt = await post(bank, `/api/invoices/${stranded}/transition`, {
      action: "confirmRialReturn",
    });
    check("a return without a receipt is refused", noReceipt.body?.ok === false, noReceipt.body?.error);

    const done = await post(bank, `/api/invoices/${stranded}/transition`, {
      action: "confirmRialReturn",
      receiptNo: "TR-CANCEL-BACK",
    });
    check("with one, it closes", done.body?.data?.invoice?.status === "CANCELLED", done.body);

    const row = await db.invoice.findFirst({ where: { ref: stranded } });
    check("the receipt is on the record", row?.rialReturnReceiptNo === "TR-CANCEL-BACK", row?.rialReturnReceiptNo);
    check("and when", Boolean(row?.rialReturnedAt), row?.rialReturnedAt);
  }

  step("a closed file stays closed");
  {
    const reopened = await post(bank, `/api/invoices/${stranded}/transition`, {
      action: "confirmRialReturn",
      receiptNo: "TR-AGAIN",
    });
    check("the return cannot be replayed", reopened.body?.ok === false, reopened.body?.error);

    const paid = await post(bank, `/api/invoices/${stranded}/transition`, { action: "startPayment" });
    check("and it cannot be paid after cancelling", paid.body?.ok === false, paid.body?.error);
  }

  // ────────────────────────────────────────────────────────────────────────
  step("cancelling before the rial arrived closes it outright");
  {
    const early = await anImport("BANK_RATE_LOCKED");
    const cancelled = await post(admin, `/api/invoices/${early}/transition`, {
      action: "cancel",
      reason: "واردکننده منصرف شد",
    });
    check(
      "straight to CANCELLED — nothing to give back",
      cancelled.body?.data?.invoice?.status === "CANCELLED",
      cancelled.body?.data?.invoice?.status,
    );
    const row = await db.invoice.findFirst({ where: { ref: early } });
    check("and no return is expected", row?.rialReturnedAt === null, row?.rialReturnedAt);
  }

  step("a reason is always required — a cancelled trade has to say why");
  {
    const ref = await anImport("BANK_RATE_LOCKED");
    const bare = await post(bank, `/api/invoices/${ref}/transition`, { action: "cancel" });
    check("cancelling without one is refused", bare.body?.ok === false, bare.body?.error);
    const row = await db.invoice.findFirst({ where: { ref } });
    check("and it is untouched", row?.status === "BANK_RATE_LOCKED", row?.status);
    // Closed on the way out. An invoice left sitting in the bank's queue is
    // the next suite's problem, and it took one to find that out.
    await post(bank, `/api/invoices/${ref}/transition`, { action: "cancel", reason: "پایان آزمون" });
  }

  step("an import the bank has not engaged with is not cancellable this way");
  {
    const ref = await anImport("APPROVED");
    const early = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "cancel",
      reason: "زود است",
    });
    // Before the bank prices it, `reject` is the organisation's tool and
    // nothing has moved. Two ways to close the same state would be two ways to
    // disagree about it.
    check("cancel is refused at APPROVED", early.body?.ok === false, early.status);
    const rejected = await post(admin, `/api/invoices/${ref}/transition`, {
      action: "reject",
      reason: "زود است",
    });
    check("reject is still the way", rejected.body?.data?.invoice?.status === "REJECTED", rejected.body);
  }

  step("nothing this suite opened is left in anyone's queue");
  {
    const open_ = await db.invoice.findMany({
      where: {
        description: `لغو واردات ${runId}`,
        status: { in: ["APPROVED", "BANK_RATE_LOCKED", "RIAL_RECEIVED", "CANCELLING"] },
      },
      select: { ref: true, status: true },
    });
    check("the bank's queue is as it was found", open_.length === 0, open_);
  }

  step("the timeline records who asked and who decided");
  {
    const events = await db.statusEvent.findMany({
      where: { subject: "invoice", subjectId: (await db.invoice.findFirst({ where: { ref: stranded } }))!.id },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true, actor: true, note: true },
    });
    check(
      "the request is in it",
      events.some((e) => e.note?.includes("ارسال نکرد") && e.fromStatus === e.toStatus),
      events,
    );
    check(
      "so is the cancellation",
      events.some((e) => e.toStatus === "CANCELLING" && e.actor === "BANK"),
      events.map((e) => `${e.fromStatus}→${e.toStatus}/${e.actor}`),
    );
    check(
      "and the return",
      events.some((e) => e.toStatus === "CANCELLED"),
      events.map((e) => e.toStatus),
    );
  }

  step("an export is untouched by any of it");
  {
    const inv = await post(importer, "/api/invoices", {
      amount: 50,
      currency: "USDT",
      description: "صادرات",
      goodsTitle: "کالا",
      counterpartyUid: reg.body?.data?.user?.uid,
    });
    const ref = inv.body?.data?.invoice?.id;
    await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    const refused = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "cancel",
      reason: "نباید بشود",
    });
    check("cancel is refused on an export", refused.body?.ok === false, refused.body?.error);
  }
}

run(main);
