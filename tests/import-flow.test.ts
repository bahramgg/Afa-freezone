/**
 * Import, the way exports work.
 *
 * The foreign seller raises the invoice for what they want to receive, the
 * system adds the fee, the bank takes rial from the importer and pays the
 * contract, and the contract sends the seller their exact figure.
 */

import { check, gatewayArtifacts, get, jar, patch, post, run, signIn, tokenDecimals } from "./harness";

import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chain = defineChain({
  id: 31337, name: "local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
const op = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const pub = createPublicClient({ chain, transport: http() });
const w = createWalletClient({ account: op, chain, transport: http() });
const ERC20 = parseAbi([
  "function mint(address,uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

async function main() {
  const { db } = await import("@/lib/server/db");
  const token = process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
  const bal = async (a: string) =>
    formatUnits(
      (await pub.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [a as `0x${string}`] })) as bigint,
      tokenDecimals(),
    );

  const admin = jar();
  const bank = jar();
  const seller = jar();
  const importer = jar();

  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");
  await patch(admin, "/api/settings", { invoiceMinAmount: 10, usdtRate: 66800, rateTolerancePercent: 10 });

  console.log("── the foreign seller registers and is cleared");
  const reg = await post(seller, "/api/auth/register", {
    fullName: "Ningbo Trading Co., Ltd",
    email: `ningbo.${Date.now()}@example.com`,
    passportNo: "CN77",
    country: "China",
  });
  const sellerUid = reg.body?.data?.user?.uid;
  await post(admin, `/api/admin/kyc/${sellerUid}`, { action: "approve" });
  check("seller registered and approved", Boolean(sellerUid), reg.body);

  // The Iranian importer already exists and is KYC-approved from earlier runs.
  const ir = await db.user.findFirst({ where: { role: "IRANIAN", kyc: "APPROVED" } });
  const importerUid = ir!.uid;

  console.log("── the seller raises an invoice for what they want to receive");
  const SELLER_WALLET = "0x4d7c3f2ae8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3";
  const created = await post(seller, "/api/invoices", {
    direction: "IMPORT",
    amount: 120,
    currency: "USDT",
    description: "واردات قطعات",
    goodsTitle: "قطعات صنعتی",
    counterpartyUid: importerUid,
    beneficiaryWallet: SELLER_WALLET,
  });
  const inv = created.body?.data?.invoice;
  check("invoice created by the seller", Boolean(inv?.id), created.body);
  check("its direction is IMPORT", inv?.tradeDirection === "IMPORT", inv?.tradeDirection);
  check("the seller asked for 120", inv?.amount === 120, inv?.amount);
  check("the system added the fee — 2.4", inv?.feeAmount === 2.4, inv?.feeAmount);
  check("and the seller's own wallet is on it", inv?.beneficiaryWallet === SELLER_WALLET, inv?.beneficiaryWallet);

  console.log("── an Iranian merchant cannot raise an import invoice");
  const wrongWay = await post(admin, "/api/invoices", {
    direction: "IMPORT",
    amount: 50,
    currency: "USDT",
    description: "x",
    goodsTitle: "y",
    counterpartyUid: importerUid,
    beneficiaryWallet: SELLER_WALLET,
  });
  check("admin is refused", wrongWay.status === 403, wrongWay.status);

  console.log("── the importer sees what they owe");
  // Read through the importer's own session rather than off the table: the
  // question is whether the invoice reaches them, and scope comes from the
  // session, so querying the database directly would answer a different one.
  await signIn(importer, ir!.email!);
  const theirs = await get(importer, "/api/invoices?status=ALL");
  const addressed = (theirs.body?.data?.list ?? []).filter((i: any) => i.tradeDirection === "IMPORT");
  check(
    "it is addressed to them",
    addressed.some((i: any) => i.id === inv.id),
    addressed.slice(0, 3).map((i: any) => i.id),
  );

  console.log("── the organisation approves, and an address is derived");
  const approved = await post(admin, `/api/invoices/${inv.id}/transition`, { action: "approve" });
  check("approved", approved.body?.data?.invoice?.status === "APPROVED", approved.body);
  const address = approved.body?.data?.invoice?.paymentAddress;
  check("with a payment address", /^0x[a-f0-9]{40}$/.test(address ?? ""), address);

  const deposit = await db.depositAddress.findFirst({ where: { invoice: { ref: inv.id } } });
  const terms = deposit!.terms as any;
  check("whose terms pay the seller, not the bank", terms.beneficiary === SELLER_WALLET, terms.beneficiary);
  check("and pin the fee to exactly 2.4", terms.feeMin === terms.feeMax && formatUnits(BigInt(terms.feeMin), tokenDecimals()) === "2.4", {
    min: terms.feeMin, max: terms.feeMax,
  });

  console.log("── the bank prices it and names the rial account");
  const locked = await post(bank, `/api/invoices/${inv.id}/transition`, {
    action: "lockRate",
    rate: 70000,
    depositAccount: "IR84-0170-0000-0011-2233-44",
  });
  const l = locked.body?.data?.invoice;
  check("rate locked", l?.status === "BANK_RATE_LOCKED", locked.body);
  check("the importer owes for 122.4, not 120", l?.rialAmount === 122.4 * 70000, l?.rialAmount);
  check("the account reaches them with it", l?.depositAccount?.startsWith("IR84"), l?.depositAccount);
  check("and the bank's margin is recorded", Number(l?.bankSpreadRial) > 0, l?.bankSpreadRial);

  const absurd = await post(bank, `/api/invoices/${inv.id}/transition`, {
    action: "lockRate", rate: 5000, depositAccount: "IR84",
  });
  check("an absurd rate is refused", absurd.status === 400 || absurd.body?.ok === false, absurd.body?.error);

  console.log("── the importer pays rial, the bank confirms");
  const rial = await post(bank, `/api/invoices/${inv.id}/transition`, {
    action: "confirmRialDeposit",
    receiptNo: "TR-IMP-001",
  });
  check("rial received", rial.body?.data?.invoice?.status === "RIAL_RECEIVED", rial.body);

  console.log("── the bank funds the contract with 122.4");
  await pub.waitForTransactionReceipt({
    hash: await w.writeContract({
      address: token, abi: ERC20, functionName: "mint",
      args: [address as `0x${string}`, parseUnits("122.4", tokenDecimals())],
    }),
  });
  // One more block so the transfer is already past the confirmation threshold
  // when the watcher first sees it. The pause is for viem's block-number cache,
  // which on a chain this fast would otherwise hand the watcher a stale head.
  await pub.waitForTransactionReceipt({ hash: await w.sendTransaction({ to: op.address, value: 0n }) });
  await new Promise((r) => setTimeout(r, 5000));

  const { runWatcher } = await import("@/lib/server/chain/watcher");
  await runWatcher();

  const paid = await db.invoice.findFirst({ where: { ref: inv.id } });
  check("the invoice is paid", paid?.status === "PAID", paid?.status);

  console.log("── no rial settlement is raised — the seller is paid in crypto");
  const settlement = await db.settlement.findFirst({ where: { sourceInvoiceId: paid!.id } });
  check("none exists", settlement === null, settlement?.ref);

  console.log("── releasing sends the seller exactly 120");
  const before = {
    seller: await bal(SELLER_WALLET),
    gw: await bal(terms.gatewayWallet),
    fz: await bal(terms.freezoneWallet),
  };
  const releaseHash = await w.writeContract({
    address: process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`,
    abi: (await gatewayArtifacts()).AfaGatewayFactory.abi,
    functionName: "release",
    args: [{
      invoiceRef: terms.invoiceRef,
      feeBps: Number(terms.feeBps),
      freezoneBps: Number(terms.freezoneBps),
      feeMin: BigInt(terms.feeMin),
      feeMax: BigInt(terms.feeMax),
      token: terms.token,
      gatewayWallet: terms.gatewayWallet,
      freezoneWallet: terms.freezoneWallet,
      beneficiary: terms.beneficiary,
    }] as never,
  });
  await pub.waitForTransactionReceipt({ hash: releaseHash });

  // Balances are read as decimal strings; round the difference so a float
  // artefact in the test does not read as a wrong split.
  const delta = (after: string, before: string) => Math.round((Number(after) - Number(before)) * 1e6) / 1e6;
  const sellerGot = delta(await bal(SELLER_WALLET), before.seller);
  const gwGot = delta(await bal(terms.gatewayWallet), before.gw);
  const fzGot = delta(await bal(terms.freezoneWallet), before.fz);

  check("the seller received exactly 120", sellerGot === 120, sellerGot);
  check("the gateway received 1.2", gwGot === 1.2, gwGot);
  check("the organisation received 1.2", fzGot === 1.2, fzGot);
  check("nothing was left at the address", (await bal(address)) === "0");
  check("and it all adds back to 122.4", sellerGot + gwGot + fzGot === 122.4);

  console.log("── the books record the fee, and owe the seller nothing");
  const entries = await db.ledgerEntry.findMany({ where: { subjectRef: inv.id } });
  const by = (a: string) => entries.find((e) => e.account === a);
  check("gateway's share is recorded", Number(by("GATEWAY_SHARE")?.amount) === 1.2, by("GATEWAY_SHARE")?.amount?.toString());
  check("organisation's share is recorded", Number(by("FREEZONE_SHARE")?.amount) === 1.2, by("FREEZONE_SHARE")?.amount?.toString());
  check("no merchant payable — the seller was paid on chain", !by("MERCHANT_PAYABLE"), by("MERCHANT_PAYABLE")?.amount?.toString());

  console.log("── the release is recorded from the contract's own event");
  const recorded = await post(bank, "/api/deposits", { id: deposit!.id, txHash: releaseHash });
  check("recorded", recorded.body?.ok === true, recorded.body);
  check("the seller's 120 is in the split it reports", recorded.body?.data?.split?.beneficiary === "120", recorded.body?.data?.split);

  const released = await db.ledgerEntry.findMany({ where: { subjectRef: address } });
  const rel = (a: string) => released.find((e) => e.account === a);
  check("the seller's payment is booked as leaving the country", Number(rel("SUPPLIER_PAID")?.amount) === 120, rel("SUPPLIER_PAID")?.amount?.toString());
  check(
    "and not as currency the bank now holds",
    !rel("BANK_HELD"),
    rel("BANK_HELD")?.amount?.toString(),
  );
  check("the address no longer holds it", Number(rel("DEPOSIT_HELD")?.amount) === -122.4, rel("DEPOSIT_HELD")?.amount?.toString());
  check("the gateway's fee is booked as received", Number(rel("GATEWAY_PAID")?.amount) === 1.2, rel("GATEWAY_PAID")?.amount?.toString());
  check(
    "and the whole release nets to zero",
    Math.round(
      (Number(rel("DEPOSIT_HELD")?.amount) +
        Number(rel("SUPPLIER_PAID")?.amount) +
        Number(rel("GATEWAY_PAID")?.amount) +
        Number(rel("FREEZONE_PAID")?.amount)) *
        1e6,
    ) === 0,
    released.map((e) => `${e.account} ${e.amount}`),
  );
}

run(main);
