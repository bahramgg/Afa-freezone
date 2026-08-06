/**
 * The organisation's side, under every condition it can be put in.
 *
 * The organisation is the only party that can let somebody into the system and
 * the only one that can let an invoice out of PENDING, so its refusals are the
 * ones the whole flow rests on. It is also, deliberately, not the system's
 * administrator: approving an invoice and disabling an account are different
 * powers and this checks they stayed apart.
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

  const buyerJar = jar();
  const buyerEmail = unique("auda-buyer") + "@example.com";
  const reg = await post(buyerJar, "/api/auth/register", {
    fullName: "Audit Admin Buyer Ltd",
    email: buyerEmail,
    passportNo: "AA1",
    country: "امارات",
  });
  const buyerUid = reg.body?.data?.user?.uid as string;

  step("nobody trades until the organisation says so");
  {
    const pending = await get(admin, "/api/admin/kyc");
    const queued = (pending.body?.data?.list ?? []).some((u: { uid: string }) => u.uid === buyerUid);
    check("a new registration lands in the queue", queued, pending.body?.data?.list?.length);

    const byMerchant = await post(merchant, `/api/admin/kyc/${buyerUid}`, { action: "approve" });
    check("a merchant cannot decide it", byMerchant.status === 403, byMerchant.status);
    const byBank = await post(bank, `/api/admin/kyc/${buyerUid}`, { action: "approve" });
    check("nor can the bank", byBank.status === 403, byBank.status);

    const noReason = await post(admin, `/api/admin/kyc/${buyerUid}`, { action: "reject" });
    check("rejecting without a reason is refused", noReason.body?.ok === false, noReason.body?.error);

    const rejected = await post(admin, `/api/admin/kyc/${buyerUid}`, {
      action: "reject",
      reason: "مدارک ناقص است",
    });
    check("rejecting with one is accepted", rejected.body?.ok === true, rejected.body?.error);
    const after = await db.user.findUnique({ where: { email: buyerEmail } });
    check("and the reason is kept where the person can read it", after?.kycRejectReason === "مدارک ناقص است", after?.kycRejectReason);

    const approved = await post(admin, `/api/admin/kyc/${buyerUid}`, { action: "approve" });
    check("the decision can be revisited", approved.body?.ok === true, approved.body?.error);
    const finalRow = await db.user.findUnique({ where: { email: buyerEmail } });
    check("and the stale reason is cleared", !finalRow?.kycRejectReason, finalRow?.kycRejectReason);
    check("who reviewed it is recorded", !!finalRow?.kycReviewedById, finalRow?.kycReviewedById);
  }

  const invoice = async () => {
    const made = await post(merchant, "/api/invoices", {
      amount: 300,
      currency: "USDT",
      description: `ارزیابی سازمان ${unique("a")}`,
      goodsTitle: "کالای ارزیابی",
      counterpartyUid: buyerUid,
    });
    return made.body?.data?.invoice?.id as string;
  };

  step("approval is the gate, and it only opens one way");
  {
    const ref = await invoice();
    const beforeRow = await db.invoice.findUnique({ where: { ref } });
    check("a pending invoice has no address", !beforeRow?.paymentAddress, beforeRow?.paymentAddress);

    const ok = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("approving derives one", /^0x[0-9a-f]{40}$/.test(ok.body?.data?.invoice?.paymentAddress ?? ""), ok.body?.data?.invoice?.paymentAddress);

    const twice = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("approving twice is refused", twice.body?.ok === false, twice.body?.error);

    const addressAfter = await db.invoice.findUnique({ where: { ref } });
    check("and the address did not move", addressAfter?.paymentAddress === ok.body?.data?.invoice?.paymentAddress, addressAfter?.paymentAddress);

    const deposit = await db.depositAddress.findFirst({ where: { invoice: { ref } } });
    check("the address is recorded with the terms it was derived from", !!deposit?.terms, deposit?.id);
  }

  step("rejection always carries a reason");
  {
    const ref = await invoice();
    const bare = await post(admin, `/api/invoices/${ref}/transition`, { action: "reject" });
    check("rejecting with no reason is refused", bare.body?.ok === false, bare.body?.error);

    const given = await post(admin, `/api/invoices/${ref}/transition`, {
      action: "reject",
      reason: "شرح کالا با اظهارنامه نمی‌خواند",
    });
    check("with one it is accepted", given.body?.data?.invoice?.status === "REJECTED", given.body?.error);

    const revived = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("and a rejected invoice cannot then be approved", revived.body?.ok === false, revived.body?.error);
  }

  step("the organisation cannot take the bank's steps");
  {
    const ref = await invoice();
    await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    for (const action of ["lockRate", "confirmRialDeposit", "startPayment"]) {
      const r = await post(admin, `/api/invoices/${ref}/transition`, {
        action,
        rate: 68400,
        receiptNo: "1",
        depositAccount: "IR620170000000338124720019",
      });
      check(`"${action}" is refused`, r.body?.ok === false, { action, err: r.body?.error?.message });
    }
  }

  step("approving an invoice is not the same power as running the system");
  {
    const users = await get(admin, "/api/admin/users");
    check("the organisation can see who is in the system", users.body?.ok === true, users.status);

    const logs = await get(admin, "/api/system/logs");
    check("but the system's own logs are a different door", logs.status === 403 || logs.status === 404, logs.status);

    const access = await get(admin, "/api/system/access");
    check("and so is the list that grants operator roles", access.status === 403 || access.status === 404, access.status);
  }

  step("the books balance, and say who is owed what");
  {
    const view = await get(admin, "/api/ledger");
    check("the organisation can read them", view.body?.ok === true, view.status);
    const balances: { account: string; amount: string }[] = view.body?.data?.balances ?? [];
    check("with named accounts", balances.length > 0, balances.map((b) => b.account));

    /**
     * The invariant, over every payment the system has ever recorded.
     *
     * These books are a balance sheet rather than signed double-entry: what the
     * gateway holds is written positive, and so is every claim on it. So the
     * whole table does not net to zero — what has to hold is that for each
     * payment, the claims equal what arrived. Exporting, that is the merchant's
     * share plus the two fee shares; importing, the seller's remainder leaves
     * the country the moment the contract splits it and is nobody's claim here,
     * so only the fee is accounted for and the claims come to less.
     */
    const paid = await db.ledgerEntry.findMany({ where: { kind: "INVOICE_PAID" } });
    const byInvoice = new Map<string, Record<string, number>>();
    for (const e of paid) {
      const key = e.subjectRef ?? "—";
      const row = byInvoice.get(key) ?? {};
      row[e.account] = (row[e.account] ?? 0) + Number(e.amount);
      byInvoice.set(key, row);
    }
    const broken = [...byInvoice.entries()].filter(([, r]) => {
      const held = r.DEPOSIT_HELD ?? 0;
      const claims = (r.MERCHANT_PAYABLE ?? 0) + (r.GATEWAY_SHARE ?? 0) + (r.FREEZONE_SHARE ?? 0);
      // An import has no merchant payable, so its claims fall short by the
      // seller's remainder rather than matching.
      return r.MERCHANT_PAYABLE === undefined ? claims > held + 1e-6 : Math.abs(held - claims) > 1e-6;
    });
    check(
      `every payment's claims add up to what arrived (${byInvoice.size} checked)`,
      broken.length === 0,
      broken.slice(0, 3),
    );

    /**
     * Money is conserved on release.
     *
     * A release does two things at once: it moves the money out of the deposit
     * address into the three places the contract sent it, and it discharges the
     * claims raised when the payment arrived. Only the first half is a movement
     * of money, so only the first half has to net to nothing — the whole group
     * does not, and asserting that it did would be asserting the wrong model.
     */
    const ASSETS = ["DEPOSIT_HELD", "BANK_HELD", "SUPPLIER_PAID", "GATEWAY_PAID", "FREEZONE_PAID"];
    const released = await db.ledgerEntry.findMany({
      where: { kind: "DEPOSIT_RELEASED", account: { in: ASSETS as never } },
    });
    const byRelease = new Map<string, number>();
    for (const e of released) {
      const key = e.subjectRef ?? "—";
      byRelease.set(key, (byRelease.get(key) ?? 0) + Number(e.amount));
    }
    const leaking = [...byRelease.entries()].filter(([, sum]) => Math.abs(sum) > 1e-6);
    check(
      `what left each deposit address equals what reached its three destinations (${byRelease.size} checked)`,
      leaking.length === 0,
      leaking.slice(0, 3),
    );
  }

  step("the organisation sees every invoice, and each merchant sees only theirs");
  {
    const everything = await get(admin, "/api/invoices?status=ALL");
    const adminCount = (everything.body?.data?.list ?? []).length;
    const mine = await get(merchant, "/api/invoices?status=ALL");
    const merchantCount = (mine.body?.data?.list ?? []).length;
    check("the organisation's list is the larger", adminCount >= merchantCount, { adminCount, merchantCount });

    // The scope must come from the session, not from anything the caller sends.
    const spoofed = await get(merchant, "/api/invoices?status=ALL&ownerId=all&scope=all");
    check(
      "and a merchant cannot widen it with a query parameter",
      (spoofed.body?.data?.list ?? []).length === merchantCount,
      { got: spoofed.body?.data?.list?.length, expected: merchantCount },
    );
  }

  await db.invoice.deleteMany({ where: { description: { contains: "ارزیابی سازمان" } } });
}

run(main);
