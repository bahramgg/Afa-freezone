import { chain, check, db, jar, patch, post, run, signIn, step, unique, STAFF } from "./harness";

/**
 * Who decides the fee.
 *
 * An admin can change the fee in the settings panel, but the contract splits by
 * its own terms — terms fixed when the deposit address was derived, and beyond
 * anyone's reach afterwards. If the books follow the panel they stop describing
 * what happened to the money, and the difference is a real shortfall somebody
 * eventually has to explain.
 */
async function main() {
  const admin = jar();
  const merchant = jar();
  const buyer = jar();

  await signIn(admin, STAFF.admin);
  await signIn(merchant, STAFF.merchant);

  const reg = await post(buyer, "/api/auth/register", {
    fullName: "Fee Buyer",
    email: unique("fee.buyer") + "@afa.local",
    passportNo: "FEE1",
    country: "China",
  });
  const buyerUid = reg.body?.data?.user?.uid;
  check("a buyer to invoice", Boolean(buyerUid), reg.body);

  step("the admin sets the panel fee to 3%, the contract stays at 2%");
  await patch(admin, "/api/settings", { feeBasePercent: 3, invoiceMinAmount: 10 });

  const live = await post(admin, "/api/settings", {});
  check(
    "the panel can see what the contract really does",
    live.body?.data?.contract?.feePercent === 2,
    live.body?.data?.contract,
  );

  const inv = await post(merchant, "/api/invoices", {
    amount: 1000,
    currency: "USDT",
    description: "اختلاف کارمزد",
    goodsTitle: "کالای آزمون",
    counterpartyUid: buyerUid,
  });
  const ref = inv.body?.data?.invoice?.id;
  await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });

  const row = await db.invoice.findFirst({ where: { ref }, include: { depositAddress: true } });
  check("the invoice got an address from the contract", Boolean(row?.paymentAddress), row?.paymentAddress);

  step("a buyer pays 1000");
  const { mint, transfer, settle } = await chain();
  await mint(row!.paymentAddress!, "1000");
  await transfer(row!.paymentAddress!, "0"); // a block, so the mint is not the head
  await settle();

  const paid = await db.invoice.findUnique({ where: { id: row!.id } });
  check("the invoice is paid", paid?.status === "PAID", paid?.status);
  check(
    "the fee recorded is the contract's 2%, not the panel's 3%",
    Number(paid?.feeAmount) === 20,
    { recorded: paid?.feeAmount?.toString(), panelWouldSay: 30 },
  );
  check(
    "so the merchant is credited what the bank will actually hold",
    Number(paid?.netAmount) === 980,
    paid?.netAmount?.toString(),
  );

  const { parseTerms, splitForAmount } = await import("@/lib/server/chain/gateway-contract");
  const contractSplit = splitForAmount(parseTerms(row!.depositAddress!.terms), "1000");
  check(
    "which is exactly what the contract will send the bank",
    Number(contractSplit.net) === Number(paid?.netAmount),
    { contract: contractSplit.net, ledger: paid?.netAmount?.toString() },
  );

  const entries = await db.ledgerEntry.findMany({ where: { subjectRef: ref } });
  const by = (account: string) => entries.find((e) => e.account === account);
  check(
    "the books agree too",
    Number(by("GATEWAY_SHARE")?.amount) + Number(by("FREEZONE_SHARE")?.amount) === 20,
    {
      gateway: by("GATEWAY_SHARE")?.amount?.toString(),
      freezone: by("FREEZONE_SHARE")?.amount?.toString(),
    },
  );

  step("restoring the panel fee");
  await patch(admin, "/api/settings", { feeBasePercent: 2 });

}

run(main);
