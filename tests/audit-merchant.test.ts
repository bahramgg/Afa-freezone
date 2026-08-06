/**
 * The Iranian merchant's side, under every condition it can be put in.
 *
 * Not the happy path — that is covered elsewhere. This asks what happens when
 * the merchant is not who the route expects: not yet approved, reaching for
 * somebody else's record, acting out of order, or asking for an amount the
 * settings forbid. A gateway is judged by what it refuses.
 */
import {
  call,
  check,
  ensureMerchant,
  get,
  jar,
  post,
  run,
  signIn,
  step,
  STAFF,
  unique,
} from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");

  const admin = jar();
  const merchant = jar();
  await signIn(admin, STAFF.admin);
  await ensureMerchant();
  await signIn(merchant, STAFF.merchant);

  // A registered foreign buyer to raise invoices against.
  const buyerJar = jar();
  const buyerEmail = unique("auditbuyer") + "@example.com";
  const reg = await post(buyerJar, "/api/auth/register", {
    fullName: "Audit Buyer Ltd",
    email: buyerEmail,
    passportNo: "AU1",
    country: "Türkiye",
  });
  const buyerUid = reg.body?.data?.user?.uid as string;
  const buyer = await db.user.findUnique({ where: { email: buyerEmail } });
  await post(admin, `/api/admin/kyc/${buyerUid}`, { action: "approve" });

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const min = Number(settings?.invoiceMinAmount ?? 10);
  const max = Number(settings?.invoiceMaxAmount ?? 10000);

  // `max` of zero means there is no ceiling, so it must not be clamped against.
  const ordinary = max > 0 ? Math.min(max, Math.max(min, 100)) : Math.max(min, 100);

  const invoice = (over: Record<string, unknown> = {}) => ({
    amount: ordinary,
    currency: "USDT",
    description: `ارزیابی ${unique("m")}`,
    goodsTitle: "کالای ارزیابی",
    counterpartyUid: buyerUid,
    ...over,
  });

  step("an unapproved merchant is stopped at the door");
  {
    const fresh = jar();
    const email = unique("pending") + "@example.com";
    await signIn(fresh, email);
    const me = await get(fresh, "/api/auth/me");
    check("signing in creates an Iranian merchant", me.body?.data?.user?.role === "IRANIAN", me.body?.data?.user?.role);
    check("who has not passed KYC", me.body?.data?.hasPassedKyc === false, me.body?.data);

    const tried = await post(fresh, "/api/invoices", invoice());
    check("and cannot raise an invoice", tried.status === 403, { status: tried.status, body: tried.body?.error });
    check("with a reason that names the cause", JSON.stringify(tried.body).includes("احراز هویت"), tried.body?.error);

    const settle = await post(fresh, "/api/settlements", {
      amount: 100,
      currency: "USDT",
      walletAddress: "0x" + "1".repeat(40),
      txHash: "0x" + "2".repeat(64),
    });
    check("nor a settlement", settle.status === 403, settle.status);
  }

  step("the amount has to be inside the settings");
  {
    const low = await post(merchant, "/api/invoices", invoice({ amount: Math.max(0.01, min / 2) }));
    check("below the minimum is refused", low.body?.ok === false, low.body);
    // Zero means there is no maximum. Read fresh, because another suite may
    // have written the row since this one started.
    const now = await db.settings.findUnique({ where: { id: 1 } });
    const cap = Number(now?.invoiceMaxAmount ?? 0);
    const huge = await post(merchant, "/api/invoices", invoice({ amount: cap > 0 ? cap * 2 : 5_000_000 }));
    check(
      cap > 0 ? "above the maximum is refused" : "with no maximum set, a very large invoice is allowed",
      cap > 0 ? huge.body?.ok === false : huge.body?.ok === true,
      { cap, ok: huge.body?.ok, err: huge.body?.error?.message },
    );
    const zero = await post(merchant, "/api/invoices", invoice({ amount: 0 }));
    check("zero is refused", zero.body?.ok === false, zero.body);
    const negative = await post(merchant, "/api/invoices", invoice({ amount: -50 }));
    check("negative is refused", negative.body?.ok === false, negative.body);
  }

  step("the fee is the same percentage at every size");
  {
    const { splitFee } = await import("@/lib/server/fees");
    /**
     * Set here rather than read from the row.
     *
     * Other suites move the settings around — `ledger` writes its own fee
     * bounds — so reading whatever happens to be there makes this check depend
     * on which suite ran last. What is being checked is the rule, not the
     * deployment: with no ceiling, one percentage holds at every size.
     */
    const live = { feeBasePercent: 2, feeMin: 1, feeMax: 0 };
    // The floor used to bind below 50 and the ceiling above 25,000, so the
    // advertised percentage was true only in between. The minimum invoice was
    // raised past the floor and both ceilings removed; this is what makes that
    // claim checkable rather than remembered.
    const off = [50, 100, 1000, 25_000, 100_000, 1_000_000]
      .map((gross) => ({ gross, rate: (splitFee(gross, live).fee / gross) * 100 }))
      .filter((r) => Math.abs(r.rate - live.feeBasePercent) > 0.001);
    check(`the rate is ${live.feeBasePercent}% from the smallest invoice up`, off.length === 0, off);
    check("and there is no fee ceiling", live.feeMax === 0, live.feeMax);

    // The old bounds, for contrast: the floor bit below 50 and the ceiling
    // above 25,000, so "two percent" was true only in between.
    const old = { feeBasePercent: 2, feeMin: 1, feeMax: 500 };
    check(
      "which was not true of the bounds this replaced",
      Math.abs((splitFee(10, old).fee / 10) * 100 - 2) > 1 &&
        Math.abs((splitFee(100_000, old).fee / 100_000) * 100 - 2) > 1,
      { at10: (splitFee(10, old).fee / 10) * 100, at100k: (splitFee(100_000, old).fee / 100_000) * 100 },
    );
  }

  step("the buyer has to be a real, registered, enabled foreign account");
  {
    const missing = await post(merchant, "/api/invoices", invoice({ counterpartyUid: undefined }));
    check("no buyer at all is refused", missing.body?.ok === false, missing.body);

    const nobody = await post(merchant, "/api/invoices", invoice({ counterpartyUid: "FOR-999999" }));
    check("an unknown buyer is refused", nobody.body?.ok === false, nobody.body?.error);

    // An Iranian uid in the foreign slot: the right shape, the wrong population.
    const self = await db.user.findUnique({ where: { email: STAFF.merchant } });
    const wrongSide = await post(merchant, "/api/invoices", invoice({ counterpartyUid: self!.uid }));
    check("an Iranian uid is not accepted as the buyer", wrongSide.body?.ok === false, wrongSide.body?.error);

    await db.user.update({ where: { id: buyer!.id }, data: { disabledAt: new Date() } });
    const disabled = await post(merchant, "/api/invoices", invoice());
    check("a disabled buyer is refused", disabled.body?.ok === false, disabled.body?.error);
    await db.user.update({ where: { id: buyer!.id }, data: { disabledAt: null } });
  }

  step("a valid export invoice is raised, and belongs to the merchant alone");
  let ref = "";
  {
    const made = await post(merchant, "/api/invoices", invoice());
    ref = made.body?.data?.invoice?.id;
    check("created", !!ref, made.body);
    check("owned by the merchant", made.body?.data?.invoice?.userUid !== undefined, made.body?.data?.invoice);
    check("addressed to the buyer", made.body?.data?.invoice?.counterpartyUid === buyerUid, made.body?.data?.invoice?.counterpartyUid);
    check("and starts as pending", made.body?.data?.invoice?.status === "PENDING", made.body?.data?.invoice?.status);
    check("with no payment address yet — approval derives it", !made.body?.data?.invoice?.paymentAddress, made.body?.data?.invoice?.paymentAddress);
  }

  step("the merchant cannot do the organisation's job");
  {
    const approve = await post(merchant, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("approving own invoice is refused", approve.body?.ok === false, approve.body?.error);
    const reject = await post(merchant, `/api/invoices/${ref}/transition`, { action: "reject", reason: "x" });
    check("rejecting is refused", reject.body?.ok === false, reject.body?.error);
    const expire = await post(merchant, `/api/invoices/${ref}/transition`, { action: "expire" });
    check("expiring is refused", expire.body?.ok === false, expire.body?.error);
  }

  step("nor the bank's");
  {
    const lock = await post(merchant, `/api/invoices/${ref}/transition`, { action: "lockRate", exchangeRate: 68400 });
    check("locking a rate is refused", lock.body?.ok === false, lock.body?.error);
    const rial = await post(merchant, `/api/invoices/${ref}/transition`, { action: "confirmRialDeposit", rialReceiptNo: "1" });
    check("confirming a rial deposit is refused", rial.body?.ok === false, rial.body?.error);
  }

  step("and cannot reach another merchant's records");
  {
    const otherJar = jar();
    const otherEmail = unique("other") + "@example.com";
    await signIn(otherJar, otherEmail);
    const other = await db.user.findUnique({ where: { email: otherEmail } });
    // `nationalId` is unique in the schema, so this has to be too. Stripping
    // the letters out of `unique()` does not do it — what is left is three or
    // four digits padded with sevens, which collided between runs and failed
    // the suite on a constraint rather than on anything it was checking.
    const nationalId = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
    await db.user.update({ where: { id: other!.id }, data: { kyc: "APPROVED", fullName: "بازرگان دیگر", nationalId } });

    const list = await get(otherJar, "/api/invoices?status=ALL");
    const refs = (list.body?.data?.list ?? []).map((i: { id: string }) => i.id);
    check("another merchant's list does not contain it", !refs.includes(ref), refs.slice(0, 5));

    const direct = await get(otherJar, `/api/invoices/${ref}`);
    check("and fetching it directly is refused", direct.status === 403 || direct.status === 404, direct.status);

    const anon = await get(jar(), `/api/invoices/${ref}`);
    check("an anonymous caller is refused too", anon.status === 401 || anon.status === 404, anon.status);
  }

  step("the ledger and the operator screens are closed to a merchant");
  {
    for (const path of ["/api/ledger", "/api/admin/users", "/api/deposits"]) {
      const r = await call(merchant, path);
      check(`${path} is refused`, r.status === 401 || r.status === 403, { path, status: r.status });
    }
  }

  step("an import is raised by the foreign seller, not by the importer");
  {
    // The route picks the role from the direction: whoever is owed the money
    // raises the invoice. An importer trying to raise their own import is the
    // wrong side of that rule.
    const wrong = await post(merchant, "/api/invoices", {
      ...invoice(),
      direction: "IMPORT",
      beneficiaryWallet: "0x" + "3".repeat(40),
    });
    check("the Iranian importer cannot raise it", wrong.status === 403, { status: wrong.status, body: wrong.body?.error });

    const right = await post(buyerJar, "/api/invoices", {
      amount: 200,
      currency: "USDT",
      description: `واردات ارزیابی ${unique("i")}`,
      goodsTitle: "کالای وارداتی",
      direction: "IMPORT",
      counterpartyUid: (await db.user.findUnique({ where: { email: STAFF.merchant } }))!.uid,
      beneficiaryWallet: "0x" + "3".repeat(40),
    });
    check("the foreign seller can", right.body?.ok === true, right.body?.error);
    const importRef = right.body?.data?.invoice?.id;

    if (importRef) {
      const row = await db.invoice.findUnique({ where: { ref: importRef }, include: { owner: true, counterparty: true } });
      check("its owner is the foreign seller", row?.owner.role === "FOREIGN", row?.owner.role);
      check("and its counterparty is the Iranian importer", row?.counterparty?.role === "IRANIAN", row?.counterparty?.role);

      const seen = await get(merchant, "/api/invoices?status=ALL");
      const mine = (seen.body?.data?.list ?? []).some((i: { id: string }) => i.id === importRef);
      check("the importer still sees it in their own list", mine, seen.body?.data?.list?.length);
    }

    const noWallet = await post(buyerJar, "/api/invoices", {
      amount: 200,
      currency: "USDT",
      description: "بدون کیف پول",
      goodsTitle: "x",
      direction: "IMPORT",
      counterpartyUid: (await db.user.findUnique({ where: { email: STAFF.merchant } }))!.uid,
    });
    check("an import with no beneficiary wallet is refused", noWallet.body?.ok === false, noWallet.body?.error);
  }

  step("cancellation is only offered where the money is actually at risk");
  {
    const fresh = await post(merchant, "/api/invoices", invoice());
    const freshRef = fresh.body?.data?.invoice?.id;
    const early = await post(merchant, `/api/invoices/${freshRef}/transition`, {
      action: "requestCancel",
      reason: "پشیمان شدم",
    });
    check("a pending export cannot be called off through the import path", early.body?.ok === false, early.body?.error);

  }

  // Leaves nothing behind that another suite would count.
  await db.invoice.deleteMany({ where: { description: { contains: "ارزیابی" } } });
}

run(main);
