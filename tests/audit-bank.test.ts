/**
 * The bank's side, under every condition it can be put in.
 *
 * The bank is the only party that both takes rial and releases currency, so
 * these are the steps where a wrong order or a wrong role costs real money.
 * Each import step is tried early, twice, and by the wrong person.
 */
import { check, ensureMerchant, get, jar, post, run, signIn, step, STAFF, unique } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");

  const admin = jar();
  const bank = jar();
  const merchant = jar();
  await signIn(admin, STAFF.admin);
  await signIn(bank, STAFF.bank);
  await ensureMerchant();
  await signIn(merchant, STAFF.merchant);
  const merchantRow = await db.user.findUnique({ where: { email: STAFF.merchant } });

  const seller = jar();
  const sellerEmail = unique("audb-seller") + "@example.com";
  const reg = await post(seller, "/api/auth/register", {
    fullName: "Audit Seller Ltd",
    email: sellerEmail,
    passportNo: "AB1",
    country: "چین",
  });
  await post(admin, `/api/admin/kyc/${reg.body?.data?.user?.uid}`, { action: "approve" });

  /** A fresh import invoice, raised by the seller as the routes require. */
  const newImport = async (amount = 400) => {
    const made = await post(seller, "/api/invoices", {
      amount,
      currency: "USDT",
      description: `ارزیابی بانک ${unique("b")}`,
      goodsTitle: "کالای وارداتی",
      direction: "IMPORT",
      counterpartyUid: merchantRow!.uid,
      beneficiaryWallet: "0x" + "5".repeat(40),
    });
    return made.body?.data?.invoice?.id as string;
  };

  step("the bank cannot do the organisation's job");
  {
    const ref = await newImport();
    const approve = await post(bank, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("approving an invoice is refused", approve.body?.ok === false, approve.body?.error);
    const reject = await post(bank, `/api/invoices/${ref}/transition`, { action: "reject", reason: "x" });
    check("rejecting is refused", reject.body?.ok === false, reject.body?.error);
    const kyc = await post(bank, `/api/admin/kyc/${reg.body?.data?.user?.uid}`, { action: "approve" });
    check("deciding KYC is refused", kyc.status === 403, kyc.status);
  }

  step("no step of an import may be taken before the one before it");
  {
    const ref = await newImport();

    const earlyRial = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo: "1",
    });
    check("confirming rial before a rate is locked is refused", earlyRial.body?.ok === false, earlyRial.body?.error);

    const earlyPay = await post(bank, `/api/invoices/${ref}/transition`, { action: "startPayment" });
    check("funding before the rial arrives is refused", earlyPay.body?.ok === false, earlyPay.body?.error);

    const earlyRate = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "lockRate",
      rate: 68400,
      depositAccount: "IR000000000000000000000001",
    });
    check("locking a rate before approval is refused", earlyRate.body?.ok === false, earlyRate.body?.error);
  }

  step("the import walk, in order, with each step tried twice");
  let ref = "";
  {
    ref = await newImport();
    await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });

    const locked = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "lockRate",
      rate: 68400,
      depositAccount: "IR620170000000338124720019",
    });
    check("the rate locks", locked.body?.data?.invoice?.status === "BANK_RATE_LOCKED", locked.body?.error);
    check("and the rial figure is computed, not taken from the caller", Number(locked.body?.data?.invoice?.rialAmount) > 0, locked.body?.data?.invoice?.rialAmount);
    check("the account reaches the importer", !!locked.body?.data?.invoice?.depositAccount, locked.body?.data?.invoice?.depositAccount);

    const twice = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "lockRate",
      rate: 70000,
      depositAccount: "IR620170000000338124720019",
    });
    check("locking a second time is refused", twice.body?.ok === false, twice.body?.error);

    const stillFirst = await db.invoice.findUnique({ where: { ref } });
    check("so the first rate stands", Number(stillFirst?.exchangeRate) === 68400, stillFirst?.exchangeRate?.toString());

    const byAdmin = await post(admin, `/api/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo: "9",
    });
    check("the organisation cannot confirm the bank's rial", byAdmin.body?.ok === false, byAdmin.body?.error);

    const rial = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo: "8842197",
    });
    check("the bank can", rial.body?.data?.invoice?.status === "RIAL_RECEIVED", rial.body?.error);

    const rialTwice = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialDeposit",
      receiptNo: "8842197",
    });
    check("confirming it twice is refused", rialTwice.body?.ok === false, rialTwice.body?.error);
  }

  step("an absurd rate is refused");
  {
    const other = await newImport();
    await post(admin, `/api/invoices/${other}/transition`, { action: "approve" });
    const silly = await post(bank, `/api/invoices/${other}/transition`, {
      action: "lockRate",
      rate: 1,
      depositAccount: "IR620170000000338124720019",
    });
    check("a rate far outside the settings is refused", silly.body?.ok === false, silly.body?.error);

    const negative = await post(bank, `/api/invoices/${other}/transition`, {
      action: "lockRate",
      rate: -68400,
      depositAccount: "IR620170000000338124720019",
    });
    check("a negative rate is refused", negative.body?.ok === false, negative.body?.error);
  }

  step("paying the contract is the importer's job, not the bank's");
  {
    const payRef = await newImport(500);
    await post(admin, `/api/invoices/${payRef}/transition`, { action: "approve" });
    await post(bank, `/api/invoices/${payRef}/transition`, {
      action: "lockRate",
      rate: 68400,
      depositAccount: "IR620170000000338124720019",
    });
    await post(bank, `/api/invoices/${payRef}/transition`, { action: "confirmRialDeposit", receiptNo: "77" });

    // The bank supplies the currency outside the system. What it may not do is
    // make the payment itself — that was its job and is not any more.
    const byBank = await post(bank, `/api/invoices/${payRef}/transition`, { action: "startPayment" });
    check("the bank cannot start the payment", byBank.body?.ok === false, byBank.body?.error);

    const bySeller = await post(seller, `/api/invoices/${payRef}/transition`, { action: "startPayment" });
    check("nor can the foreign seller, who is owed it", bySeller.body?.ok === false, bySeller.body?.error);

    const byImporter = await post(merchant, `/api/invoices/${payRef}/transition`, { action: "startPayment" });
    check("the importer can", byImporter.body?.ok === true, byImporter.body?.error);
    check("which moves it to awaiting payment", byImporter.body?.data?.invoice?.status === "PAYMENT_PENDING", byImporter.body?.data?.invoice?.status);

    const invented = await post(merchant, `/api/invoices/${payRef}/transition`, {
      action: "confirmPayment",
      txHash: "0x" + "e".repeat(64),
    });
    check("and even the importer's own claimed hash is checked on chain", invented.body?.ok === false, invented.body?.error);
  }

  step("only the importer or an operator may call an import off");
  {
    const outsider = jar();
    await signIn(outsider, unique("outsider") + "@example.com");
    const byOutsider = await post(outsider, `/api/invoices/${ref}/transition`, {
      action: "cancel",
      reason: "بی‌ربط",
    });
    check("an unrelated account cannot cancel it", byOutsider.body?.ok === false, byOutsider.body?.error);

    const noReason = await post(bank, `/api/invoices/${ref}/transition`, { action: "cancel" });
    check("cancelling without a reason is refused", noReason.body?.ok === false, noReason.body?.error);

    const cancelled = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "cancel",
      reason: "فروشنده کالا را نفرستاد",
    });
    check(
      "with the rial already taken, it goes to CANCELLING and not straight to CANCELLED",
      cancelled.body?.data?.invoice?.status === "CANCELLING",
      cancelled.body?.data?.invoice?.status,
    );

    const skip = await post(bank, `/api/invoices/${ref}/transition`, { action: "startPayment" });
    check("and a cancelled import cannot then be funded", skip.body?.ok === false, skip.body?.error);

    const returned = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialReturn",
      receiptNo: "552199",
    });
    check("recording the rial's return closes it", returned.body?.data?.invoice?.status === "CANCELLED", returned.body?.error);

    const again = await post(bank, `/api/invoices/${ref}/transition`, {
      action: "confirmRialReturn",
      receiptNo: "552199",
    });
    check("and cannot be recorded twice", again.body?.ok === false, again.body?.error);
  }

  step("the bank sees the queues it owns, and the books it does not");
  {
    const imports = await get(bank, "/api/invoices?status=ALL");
    check("the bank can read the invoice queue", imports.body?.ok === true, imports.body?.error);
    const deposits = await get(bank, "/api/deposits");
    check("and the deposit addresses", deposits.body?.ok === true, deposits.body?.error);
    // The bank holds the currency, so it is allowed the books it is party to —
    // `requireRole("ADMIN", "BANK")`. It is the user list that is not its business.
    const ledger = await get(bank, "/api/ledger");
    check("the books are open to the bank as well as the organisation", ledger.body?.ok === true, ledger.status);
    const users = await get(bank, "/api/admin/users");
    check("and so is the user list", users.status === 403, users.status);
  }

  await db.invoice.deleteMany({ where: { description: { contains: "ارزیابی بانک" } } });
}

run(main);
