/**
 * The two trade flows and every staff action around them, driven the way the
 * panels drive them: through the API each screen calls, with real money on a
 * real chain and the books checked at the end.
 */

import type { Jar } from "./harness";
import { call, check, gatewayArtifacts, jar, patch, post, run, BASE } from "./harness";

import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function signIn(j: Jar, email: string) {
  let req = await post(j, "/api/auth/otp/request", { email });
  if (req.body?.error?.code === "too_many_requests") {
    const wait = Number(/(\d+)/.exec(req.body.error.message ?? "")?.[1] ?? 60);
    console.log(`     waiting ${wait}s on the resend cooldown…`);
    await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
    req = await post(j, "/api/auth/otp/request", { email });
  }
  const code = req.body?.data?.devCode;
  if (!code) throw new Error(`no code for ${email}: ${JSON.stringify(req.body).slice(0, 200)}`);
  return post(j, "/api/auth/otp/verify", { email, code });
}

const chain = defineChain({ id: 31337, name: "local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } });
const op = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const pub = createPublicClient({ chain, transport: http() });
const w = createWalletClient({ account: op, chain, transport: http() });
const ERC20 = parseAbi(["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"]);

async function main() {
  const { db } = await import("@/lib/server/db");
  const token = process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
  const bal = async (a: string) => formatUnits((await pub.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [a as `0x${string}`] })) as bigint, 18);
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  /** Mines past the confirmation threshold, then lets the cache expire. */
  async function settleChain() {
    await pub.waitForTransactionReceipt({ hash: await w.sendTransaction({ to: op.address, value: 0n }) });
    await new Promise((r) => setTimeout(r, 5000));
    await runWatcher();
  }

  const admin = jar(), bank = jar(), merchant = jar(), buyer = jar(), seller = jar(), system = jar();
  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");
  await signIn(system, "system@afa.local");
  await signIn(merchant, "merchant@afa.local");
  await patch(admin, "/api/settings", { invoiceMinAmount: 10, usdtRate: 66800, rateTolerancePercent: 10, feeBasePercent: 2 });

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ REGISTRATION AND KYC");
  const buyerEmail = `qa.buyer.${Date.now()}@afa.local`;
  const reg = await post(buyer, "/api/auth/register", {
    fullName: "QA Buyer Ltd", email: buyerEmail, passportNo: "QA1", country: "China",
  });
  const buyerUid = reg.body?.data?.user?.uid;
  check("a foreign merchant can register", Boolean(buyerUid), reg.body);
  check("and starts unverified", reg.body?.data?.hasPassedKyc === false, reg.body?.data);

  const pending = await call(admin, "/api/admin/kyc?status=PENDING");
  check("the organisation sees them in the KYC queue",
    (pending.body?.data?.list ?? []).some((u: any) => u.uid === buyerUid), pending.body?.error);
  const blocked = await post(buyer, "/api/invoices", { direction: "IMPORT", amount: 50, currency: "USDT", description: "x", goodsTitle: "y", counterpartyUid: "IR-001", beneficiaryWallet: "0x" + "1".repeat(40) });
  check("an unverified account cannot trade yet", blocked.status === 403, blocked.status);
  const approved = await post(admin, `/api/admin/kyc/${buyerUid}`, { action: "approve" });
  check("the organisation approves them", approved.body?.ok === true, approved.body);

  const sellerEmail = `qa.seller.${Date.now()}@afa.local`;
  const sreg = await post(seller, "/api/auth/register", { fullName: "QA Ningbo Co", email: sellerEmail, passportNo: "QA2", country: "China" });
  const sellerUid = sreg.body?.data?.user?.uid;
  await post(admin, `/api/admin/kyc/${sellerUid}`, { action: "approve" });
  check("a second foreign account is cleared too", Boolean(sellerUid), sreg.body);

  const importer = await db.user.findUnique({ where: { email: "merchant@afa.local" } });

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ EXPORT — an Iranian merchant is paid by a foreign buyer");
  const exp = await post(merchant, "/api/invoices", {
    amount: 1000, currency: "USDT", description: "صادرات آزمون کیفیت",
    goodsTitle: "کالای آزمون", counterpartyUid: buyerUid,
  });
  const expRef = exp.body?.data?.invoice?.id;
  check("the merchant raises an invoice", Boolean(expRef), exp.body);
  check("the fee is worked out for them", exp.body?.data?.invoice?.fee === 20, exp.body?.data?.invoice?.fee);

  const notYet = await post(buyer, `/api/invoices/${expRef}/transition`, { action: "confirmPayment", txHash: "0x" + "0".repeat(64) });
  check("it cannot be paid before the organisation approves", notYet.status >= 400, notYet.status);

  const expApproved = await post(admin, `/api/invoices/${expRef}/transition`, { action: "approve" });
  const expAddress = expApproved.body?.data?.invoice?.paymentAddress;
  check("approving derives a payment address", /^0x[a-f0-9]{40}$/.test(expAddress ?? ""), expApproved.body);

  const buyerView = await call(buyer, "/api/invoices?status=ALL");
  check("the invoice reaches the buyer's own panel",
    (buyerView.body?.data?.list ?? []).some((i: any) => i.id === expRef), buyerView.body?.error);

  console.log("── the buyer pays on chain");
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: token, abi: ERC20, functionName: "mint", args: [expAddress as `0x${string}`, parseUnits("1000", 18)] }) });
  await settleChain();
  const expPaid = await db.invoice.findFirst({ where: { ref: expRef } });
  check("the watcher marks it paid", expPaid?.status === "PAID", expPaid?.status);
  check("crediting what actually arrived", Number(expPaid?.receivedAmount) === 1000, expPaid?.receivedAmount?.toString());
  check("with the contract's fee, not the panel's", Number(expPaid?.feeAmount) === 20, expPaid?.feeAmount?.toString());

  const settlement = await db.settlement.findFirst({ where: { sourceInvoiceId: expPaid!.id } });
  check("a rial payout is raised for the merchant", Boolean(settlement), settlement?.ref);
  check("for the net, after the fee", Number(settlement?.amount) === 980, settlement?.amount?.toString());

  console.log("── the operator releases the deposit, and the contract splits it");
  const depositRow = await db.depositAddress.findFirst({ where: { invoiceId: expPaid!.id } });
  const terms = depositRow!.terms as any;
  const before = { gw: await bal(terms.gatewayWallet), fz: await bal(terms.freezoneWallet), bank: await bal(terms.beneficiary) };
  const releaseHash = await w.writeContract({
    address: process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`,
    abi: (await gatewayArtifacts()).AfaGatewayFactory.abi,
    functionName: "release",
    args: [{ invoiceRef: terms.invoiceRef, feeBps: Number(terms.feeBps), freezoneBps: Number(terms.freezoneBps), feeMin: BigInt(terms.feeMin), feeMax: BigInt(terms.feeMax), token: terms.token, gatewayWallet: terms.gatewayWallet, freezoneWallet: terms.freezoneWallet, beneficiary: terms.beneficiary }] as never,
  });
  await pub.waitForTransactionReceipt({ hash: releaseHash });
  const d = (a: string, b: string) => Math.round((Number(a) - Number(b)) * 1e6) / 1e6;
  check("the gateway is paid 10", d(await bal(terms.gatewayWallet), before.gw) === 10);
  check("the organisation is paid 10", d(await bal(terms.freezoneWallet), before.fz) === 10);
  check("the bank receives 980", d(await bal(terms.beneficiary), before.bank) === 980);
  const rec = await post(bank, "/api/deposits", { id: depositRow!.id, txHash: releaseHash });
  check("the release is recorded from the contract's own event", rec.body?.ok === true, rec.body);

  console.log("── the bank pays the merchant rial and closes it");
  // A payout born of a paid invoice starts with the bank: the organisation
  // already cleared the invoice, and reviewing the same money twice is not
  // oversight. The crypto leg is skipped too — the bank is already holding it.
  check("it starts with the bank, not another admin review", settlement?.status === "AWAITING_BANK", settlement?.status);
  const tooSoon = await post(bank, `/api/settlements/${settlement!.ref}/transition`, { action: "lockRate", rate: 66000 });
  check("the bank cannot price it before the merchant names an account", tooSoon.status === 400, tooSoon.body?.error);

  let st = await post(merchant, `/api/settlements/${settlement!.ref}/transition`, { action: "setPayoutAccount", payoutAccount: "IR62-QA-0001" });
  check("the merchant names where the rial should go", st.body?.ok === true, st.body?.error);
  st = await post(bank, `/api/settlements/${settlement!.ref}/transition`, { action: "lockRate", rate: 66000 });
  check("the bank prices it", st.body?.data?.settlement?.status === "BANK_RATE_LOCKED", st.body?.error);
  check("and its margin is recorded", Number(st.body?.data?.settlement?.bankSpreadRial ?? 0) !== 0, st.body?.data?.settlement?.bankSpreadRial);
  st = await post(bank, `/api/settlements/${settlement!.ref}/transition`, { action: "settle", receiptNo: "QA-RIAL-1" });
  check("the merchant is paid in rial", st.body?.data?.settlement?.status === "SETTLED", st.body?.error);

  const cleared = await db.ledgerEntry.findMany({ where: { subjectRef: settlement!.ref } });
  check("the debt to the merchant is discharged in the books",
    cleared.some((e) => e.account === "MERCHANT_PAYABLE" && Number(e.amount) < 0),
    cleared.map((e) => `${e.account}=${e.amount}`));

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ IMPORT — a foreign seller is paid by the bank");
  const SELLER_WALLET = "0x" + "b".repeat(40);
  const imp = await post(seller, "/api/invoices", {
    direction: "IMPORT", amount: 120, currency: "USDT", description: "واردات آزمون",
    goodsTitle: "قطعات", counterpartyUid: importer!.uid, beneficiaryWallet: SELLER_WALLET,
  });
  const impRef = imp.body?.data?.invoice?.id;
  check("the seller raises an invoice for their own figure", imp.body?.data?.invoice?.amount === 120, imp.body);
  check("and the system adds the fee", imp.body?.data?.invoice?.fee === 2.4, imp.body?.data?.invoice?.fee);

  const impApproved = await post(admin, `/api/invoices/${impRef}/transition`, { action: "approve" });
  const impAddress = impApproved.body?.data?.invoice?.paymentAddress;
  check("the organisation approves it", /^0x[a-f0-9]{40}$/.test(impAddress ?? ""), impApproved.body);

  const locked = await post(bank, `/api/invoices/${impRef}/transition`, { action: "lockRate", rate: 70000, depositAccount: "IR84-QA" });
  check("the bank prices it in rial", locked.body?.data?.invoice?.status === "BANK_RATE_LOCKED", locked.body?.error);
  check("the importer owes for principal plus fee", locked.body?.data?.invoice?.rialAmount === 122.4 * 70000, locked.body?.data?.invoice?.rialAmount);

  const told = await db.notification.findFirst({ where: { kind: "INVOICE_RATE_LOCKED", body: { contains: impRef } }, include: { user: true } });
  check("and the importer is the one told to pay", told?.user.role === "IRANIAN", told?.user.role);

  const rial = await post(bank, `/api/invoices/${impRef}/transition`, { action: "confirmRialDeposit", receiptNo: "QA-IMP-1" });
  check("the bank records the rial arriving", rial.body?.data?.invoice?.status === "RIAL_RECEIVED", rial.body?.error);

  console.log("── the bank funds the contract");
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: token, abi: ERC20, functionName: "mint", args: [impAddress as `0x${string}`, parseUnits("122.4", 18)] }) });
  await settleChain();
  const impPaid = await db.invoice.findFirst({ where: { ref: impRef } });
  check("the invoice is paid", impPaid?.status === "PAID", impPaid?.status);
  check("no rial settlement is raised — the seller is paid in currency",
    (await db.settlement.findFirst({ where: { sourceInvoiceId: impPaid!.id } })) === null);

  const impDeposit = await db.depositAddress.findFirst({ where: { invoiceId: impPaid!.id } });
  const it = impDeposit!.terms as any;
  const b2 = { seller: await bal(SELLER_WALLET), gw: await bal(it.gatewayWallet), fz: await bal(it.freezoneWallet) };
  const impRelease = await w.writeContract({
    address: process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`,
    abi: (await gatewayArtifacts()).AfaGatewayFactory.abi,
    functionName: "release",
    args: [{ invoiceRef: it.invoiceRef, feeBps: Number(it.feeBps), freezoneBps: Number(it.freezoneBps), feeMin: BigInt(it.feeMin), feeMax: BigInt(it.feeMax), token: it.token, gatewayWallet: it.gatewayWallet, freezoneWallet: it.freezoneWallet, beneficiary: it.beneficiary }] as never,
  });
  await pub.waitForTransactionReceipt({ hash: impRelease });
  check("the seller receives their exact 120", d(await bal(SELLER_WALLET), b2.seller) === 120);
  check("the gateway 1.2", d(await bal(it.gatewayWallet), b2.gw) === 1.2);
  check("the organisation 1.2", d(await bal(it.freezoneWallet), b2.fz) === 1.2);
  await post(bank, "/api/deposits", { id: impDeposit!.id, txHash: impRelease });

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ THE BOOKS");
  const ledger = await call(admin, "/api/ledger");
  const bal2 = new Map<string, number>((ledger.body?.data?.balances ?? []).map((b: any) => [b.account as string, Number(b.amount)]));
  check("the ledger answers", (ledger.body?.data?.balances ?? []).length > 0, ledger.body?.error);
  check("the gateway's fees are booked as received", (bal2.get("GATEWAY_PAID") ?? 0) > 0, bal2.get("GATEWAY_PAID"));
  check("the organisation's too", (bal2.get("FREEZONE_PAID") ?? 0) > 0, bal2.get("FREEZONE_PAID"));
  check("the seller's payment left the country, not the bank's vault", (bal2.get("SUPPLIER_PAID") ?? 0) >= 120, bal2.get("SUPPLIER_PAID"));
  const entries = await db.ledgerEntry.findMany({ where: { subjectRef: impRef } });
  check("an import books no debt to a merchant", !entries.some((e) => e.account === "MERCHANT_PAYABLE"));

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ REFUND");
  const refInv = await post(merchant, "/api/invoices", { amount: 200, currency: "USDT", description: "برای بازگشت", goodsTitle: "کالا", counterpartyUid: buyerUid });
  const refRef = refInv.body?.data?.invoice?.id;
  const refApproved = await post(admin, `/api/invoices/${refRef}/transition`, { action: "approve" });
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: token, abi: ERC20, functionName: "mint", args: [refApproved.body.data.invoice.paymentAddress as `0x${string}`, parseUnits("200", 18)] }) });
  await settleChain();
  const created = await post(merchant, "/api/refunds", { invoiceRef: refRef, reason: "لغو سفارش" });
  check("a paid invoice can be refunded", created.body?.data?.refund?.id !== undefined, created.body?.error);
  check("to where the money came from", /^0x/.test(created.body?.data?.refund?.toAddress ?? ""), created.body?.data?.refund?.toAddress);
  const denied = await patch(merchant, "/api/refunds", { ref: created.body?.data?.refund?.id, action: "approve" });
  check("but the merchant cannot approve their own", denied.status === 403, denied.status);
  const okd = await patch(admin, "/api/refunds", { ref: created.body?.data?.refund?.id, action: "approve" });
  check("the organisation can", okd.body?.data?.refund?.status === "APPROVED", okd.body?.error);

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ SCOPE — nobody sees anyone else's trade");
  const asBuyer = await call(buyer, "/api/invoices?status=ALL");
  const leaked = (asBuyer.body?.data?.list ?? []).filter((i: any) => i.userUid !== buyerUid && i.counterpartyUid !== buyerUid);
  check("a foreign buyer sees only their own", leaked.length === 0, leaked.map((i: any) => i.id).slice(0, 3));
  check("and cannot read the books", (await call(buyer, "/api/ledger")).status === 403);
  check("nor the system panel", (await call(buyer, "/api/system/users")).status === 403);
  check("an organisation operator cannot either", (await call(admin, "/api/system/users")).status === 403);
  const bankScope = await call(bank, "/api/invoices?status=ALL");
  check("the bank sees imports only",
    (bankScope.body?.data?.list ?? []).every((i: any) => i.tradeDirection === "IMPORT"),
    (bankScope.body?.data?.list ?? []).map((i: any) => i.tradeDirection).slice(0, 5));

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ REPORTS — every role's workbook builds");
  for (const [who, j, sets] of [
    ["merchant", merchant, ["invoices", "settlements"]],
    ["admin", admin, ["invoices", "settlements", "transactions", "ledger", "users"]],
    ["bank", bank, ["settlements", "transactions", "ledger"]],
    ["foreign seller", seller, ["invoices"]],
  ] as const) {
    for (const set of sets) {
      const r = await fetch(`${BASE}/api/reports/export?dataset=${set}`, { headers: { cookie: j.cookie } });
      const buf = await r.arrayBuffer();
      check(`${who}/${set}`, r.status === 200 && buf.byteLength > 500, `${r.status} ${buf.byteLength}b`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  console.log("\n══ SYSTEM PANEL");
  const users = await call(system, "/api/system/users");
  check("every account is listed", (users.body?.data?.list?.length ?? 0) > 0, users.body?.error);
  const logs = await call(system, "/api/system/logs");
  const kinds = new Set((logs.body?.data?.list ?? []).map((l: any) => l.action));
  check("the log carries this run's sign-ins", kinds.has("LOGIN_SUCCEEDED"), [...kinds].slice(0, 8));
  check("and the trades that just happened", (logs.body?.data?.list ?? []).some((l: any) => l.source === "FLOW"));
  const banned = await patch(system, "/api/system/users", { uid: buyerUid, action: "disable", reason: "QA" });
  check("an account can be disabled", banned.body?.data?.user?.disabled === true, banned.body?.error);
  check("their session dies with it", (await call(buyer, "/api/auth/me")).body?.data?.user === null);
  await patch(system, "/api/system/users", { uid: buyerUid, action: "enable" });

}

run(main);
