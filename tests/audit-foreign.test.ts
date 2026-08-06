/**
 * The foreign merchant's side, under every condition it can be put in.
 *
 * This account is the only one in the system that belongs to somebody outside
 * the country, and the only one that reaches a page over a shared link. So the
 * questions are: can it see anything that is not addressed to it, can it move a
 * record it does not own, and can somebody who is not it open its payment page.
 */
import { call, check, ensureMerchant, get, jar, post, run, signIn, step, STAFF, unique } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");

  const admin = jar();
  const merchant = jar();
  await signIn(admin, STAFF.admin);
  await ensureMerchant();
  await signIn(merchant, STAFF.merchant);
  const merchantRow = await db.user.findUnique({ where: { email: STAFF.merchant } });

  const register = async (label: string) => {
    const j = jar();
    const email = unique(label) + "@example.com";
    const reg = await post(j, "/api/auth/register", {
      fullName: `${label} Ltd`,
      email,
      passportNo: "AF1",
      country: "Türkiye",
    });
    const uid = reg.body?.data?.user?.uid as string;
    return { j, email, uid };
  };

  const buyer = await register("audf-buyer");
  const stranger = await register("audf-stranger");

  step("a foreign account starts unapproved and can do nothing");
  {
    const me = await get(buyer.j, "/api/auth/me");
    check("registered as FOREIGN", me.body?.data?.user?.role === "FOREIGN", me.body?.data?.user?.role);
    check("and not yet through KYC", me.body?.data?.hasPassedKyc === false, me.body?.data?.hasPassedKyc);

    const raised = await post(buyer.j, "/api/invoices", {
      amount: 200,
      currency: "USDT",
      description: "پیش از احراز",
      goodsTitle: "x",
      direction: "IMPORT",
      counterpartyUid: merchantRow!.uid,
      beneficiaryWallet: "0x" + "4".repeat(40),
    });
    check("cannot raise an import invoice", raised.status === 403, { status: raised.status, err: raised.body?.error });
  }

  await post(admin, `/api/admin/kyc/${buyer.uid}`, { action: "approve" });
  await post(admin, `/api/admin/kyc/${stranger.uid}`, { action: "approve" });

  step("an approved foreign account may sell, but not export on someone's behalf");
  {
    const asExport = await post(buyer.j, "/api/invoices", {
      amount: 200,
      currency: "USDT",
      description: `صادرات از سمت خارجی ${unique("f")}`,
      goodsTitle: "x",
      counterpartyUid: merchantRow!.uid,
    });
    check("raising an export is refused", asExport.status === 403, { status: asExport.status, err: asExport.body?.error });

    const asImport = await post(buyer.j, "/api/invoices", {
      amount: 200,
      currency: "USDT",
      description: `واردات ارزیابی ${unique("f")}`,
      goodsTitle: "کالای وارداتی",
      direction: "IMPORT",
      counterpartyUid: merchantRow!.uid,
      beneficiaryWallet: "0x" + "4".repeat(40),
    });
    check("raising an import is allowed", asImport.body?.ok === true, asImport.body?.error);
  }

  step("an export addressed to them appears, and one addressed elsewhere does not");
  let ref = "";
  {
    const made = await post(merchant, "/api/invoices", {
      amount: 250,
      currency: "USDT",
      description: `ارزیابی خارجی ${unique("f")}`,
      goodsTitle: "کالای ارزیابی",
      counterpartyUid: buyer.uid,
    });
    ref = made.body?.data?.invoice?.id;
    check("the merchant raised it", !!ref, made.body?.error);

    const theirs = await get(buyer.j, "/api/invoices?status=ALL");
    const mine = (theirs.body?.data?.list ?? []).some((i: { id: string }) => i.id === ref);
    check("the addressed buyer sees it", mine, theirs.body?.data?.list?.length);

    const others = await get(stranger.j, "/api/invoices?status=ALL");
    const leaked = (others.body?.data?.list ?? []).some((i: { id: string }) => i.id === ref);
    check("another foreign account does not", !leaked, others.body?.data?.list?.length);
  }

  step("the payment page is not open to whoever holds the link");
  {
    const before = await get(buyer.j, `/api/checkout/${ref}`);
    const beforePage = await call(buyer.j, `/pay/${ref}`);
    check("the addressed buyer can open it", before.status === 200 || beforePage.status === 200, {
      api: before.status,
      page: beforePage.status,
    });

    const wrong = await call(stranger.j, `/pay/${ref}`);
    check("a different foreign account cannot", wrong.status !== 200 || !(wrong.text ?? "").includes("Amount due"), wrong.status);

    const anon = await call(jar(), `/pay/${ref}`);
    check("and an anonymous visitor is asked to sign in", !(anon.text ?? "").includes("Amount due"), anon.status);
  }

  step("they cannot move the record through anybody else's step");
  {
    for (const action of ["approve", "reject", "expire", "lockRate", "confirmRialDeposit"]) {
      const r = await post(buyer.j, `/api/invoices/${ref}/transition`, {
        action,
        reason: "x",
        exchangeRate: 68400,
        rialReceiptNo: "1",
      });
      check(`"${action}" is refused`, r.body?.ok === false, { action, status: r.status, err: r.body?.error?.code });
    }
  }

  step("paying before the organisation has approved is refused");
  {
    const early = await post(buyer.j, `/api/invoices/${ref}/transition`, { action: "startPayment" });
    check("startPayment on a pending invoice is refused", early.body?.ok === false, early.body?.error);
  }

  step("after approval, only the addressed buyer may start the payment");
  {
    const approved = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    check("the organisation approved it", approved.body?.data?.invoice?.status === "APPROVED", approved.body?.error);
    check("and an address was derived", /^0x[0-9a-f]{40}$/.test(approved.body?.data?.invoice?.paymentAddress ?? ""), approved.body?.data?.invoice?.paymentAddress);

    const byStranger = await post(stranger.j, `/api/invoices/${ref}/transition`, { action: "startPayment" });
    check("a different buyer cannot start it", byStranger.body?.ok === false, byStranger.body?.error);

    const byOwner = await post(buyer.j, `/api/invoices/${ref}/transition`, { action: "startPayment" });
    check("the addressed buyer can", byOwner.body?.ok === true, byOwner.body?.error);
  }

  step("a claimed payment is not taken on the buyer's word");
  {
    const invented = await post(buyer.j, `/api/invoices/${ref}/transition`, {
      action: "confirmPayment",
      txHash: "0x" + "f".repeat(64),
    });
    check("a made-up transaction hash is refused", invented.body?.ok === false, invented.body?.error);

    const row = await db.invoice.findUnique({ where: { ref } });
    check("and the invoice was not credited", row?.status !== "PAID", row?.status);
    check("nor was any amount recorded", !row?.receivedAmount || Number(row.receivedAmount) === 0, row?.receivedAmount?.toString());
  }

  step("operator screens are closed to a foreign account");
  {
    for (const path of ["/api/ledger", "/api/admin/users", "/api/deposits", "/api/settlements"]) {
      const r = await call(buyer.j, path);
      const refused = r.status === 401 || r.status === 403 || (r.body?.data?.list ?? []).length === 0;
      check(`${path} exposes nothing`, refused, { path, status: r.status, n: r.body?.data?.list?.length });
    }
  }

  await db.invoice.deleteMany({ where: { description: { contains: "ارزیابی" } } });
}

run(main);
