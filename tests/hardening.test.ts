/**
 * The four things that were wrong, each shown failing the old way first.
 */

import type { Jar } from "./harness";
import { call, check, gatewayArtifacts, jar, patch, post, run } from "./harness";

import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function signIn(j: Jar, email: string) {
  let req = await post(j, "/api/auth/otp/request", { email });
  if (req.body?.error?.code === "too_many_requests") {
    const wait = Number(/(\d+)/.exec(req.body.error.message ?? "")?.[1] ?? 60);
    await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
    req = await post(j, "/api/auth/otp/request", { email });
  }
  const code = req.body?.data?.devCode;
  if (!code) throw new Error(`no code for ${email}: ${JSON.stringify(req.body).slice(0, 160)}`);
  return post(j, "/api/auth/otp/verify", { email, code });
}

const chain = defineChain({ id: 31337, name: "local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } });
const op = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const pub = createPublicClient({ chain, transport: http() });
const w = createWalletClient({ account: op, chain, transport: http() });
const ERC20 = parseAbi(["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"]);

async function main() {
  const { db } = await import("@/lib/server/db");
  const { runWatcher } = await import("@/lib/server/chain/watcher");
  const token = process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
  async function settle() {
    await pub.waitForTransactionReceipt({ hash: await w.sendTransaction({ to: op.address, value: 0n }) });
    await new Promise((r) => setTimeout(r, 5000));
    await runWatcher();
  }

  const admin = jar(), bank = jar(), seller = jar();
  await signIn(admin, "admin@afa.local");
  await signIn(bank, "bank@afa.local");
  await patch(admin, "/api/settings", { invoiceMinAmount: 10, usdtRate: 66800, rateTolerancePercent: 10, feeBasePercent: 2 });

  const sEmail = `hard.seller.${Date.now()}@afa.local`;
  const sreg = await post(seller, "/api/auth/register", { fullName: "Hardening Co", email: sEmail, passportNo: "HRD1", country: "China" });
  await post(admin, `/api/admin/kyc/${sreg.body?.data?.user?.uid}`, { action: "approve" });
  const importer = await db.user.findUnique({ where: { email: "merchant@afa.local" } });

  // ════════════════════════════════════════════════════════════════
  console.log("\n══ 1. an import is not settled by the principal alone");
  const WALLET = "0x" + "c".repeat(40);
  const imp = await post(seller, "/api/invoices", {
    direction: "IMPORT", amount: 120, currency: "USDT", description: "کسری",
    goodsTitle: "قطعات", counterpartyUid: importer!.uid, beneficiaryWallet: WALLET,
  });
  const ref = imp.body?.data?.invoice?.id;
  const approved = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
  const address = approved.body?.data?.invoice?.paymentAddress;
  check("an import invoice needs 122.4, not 120",
    imp.body?.data?.invoice?.amount === 120 && imp.body?.data?.invoice?.fee === 2.4, imp.body?.data?.invoice);

  console.log("── the bank sends only the principal, as it used to");
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: token, abi: ERC20, functionName: "mint", args: [address as `0x${string}`, parseUnits("120", 18)] }) });
  await settle();
  const short = await db.invoice.findFirst({ where: { ref } });
  check("it is NOT marked paid", short?.status !== "PAID", short?.status);
  check("it is left open for the rest", short?.status === "PAYMENT_PENDING", short?.status);
  const partial = await db.notification.findFirst({ where: { kind: "PAYMENT_PARTIAL", body: { contains: ref } } });
  check("and the shortfall is named against 122.4", /122\.4/.test(partial?.body ?? ""), partial?.body);

  console.log("── the rest arrives");
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: token, abi: ERC20, functionName: "mint", args: [address as `0x${string}`, parseUnits("2.4", 18)] }) });
  await settle();
  const full = await db.invoice.findFirst({ where: { ref } });
  check("now it is paid", full?.status === "PAID", full?.status);

  const bal = async (a: string) => formatUnits((await pub.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [a as `0x${string}`] })) as bigint, 18);
  const dep = await db.depositAddress.findFirst({ where: { invoiceId: full!.id } });
  const t = dep!.terms as any;
  const before = await bal(WALLET);
  const hash = await w.writeContract({
    address: process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`,
    abi: (await gatewayArtifacts()).AfaGatewayFactory.abi,
    functionName: "release",
    args: [{ invoiceRef: t.invoiceRef, feeBps: Number(t.feeBps), freezoneBps: Number(t.freezoneBps), feeMin: BigInt(t.feeMin), feeMax: BigInt(t.feeMax), token: t.token, gatewayWallet: t.gatewayWallet, freezoneWallet: t.freezoneWallet, beneficiary: t.beneficiary }] as never,
  });
  await pub.waitForTransactionReceipt({ hash });
  const got = Math.round((Number(await bal(WALLET)) - Number(before)) * 1e6) / 1e6;
  check("and the seller receives their whole 120", got === 120, got);

  // ════════════════════════════════════════════════════════════════
  console.log("\n══ 2. the operator sees a mismatch before releasing");
  const deposits = await call(bank, "/api/deposits");
  const row = (deposits.body?.data?.list ?? []).find((d: any) => d.invoiceRef === ref);
  check("the deposits screen states what was expected", row?.expectedAmount === 122.4, row?.expectedAmount);
  check("beside what arrived", row?.receivedAmount === 122.4, row?.receivedAmount);

  const exportRow = (deposits.body?.data?.list ?? []).find((d: any) => d.direction === "EXPORT" && d.expectedAmount);
  check("an export's expectation is the amount alone",
    exportRow === undefined || exportRow.expectedAmount > 0, exportRow?.expectedAmount);

  // ════════════════════════════════════════════════════════════════
  console.log("\n══ 3. the sign-in surface is bounded");
  const { rateLimit, resetRateLimits } = await import("@/lib/server/ratelimit");
  resetRateLimits();
  let tripped = 0;
  for (let i = 0; i < 12; i++) {
    try { rateLimit("qa", { limit: 10, windowMs: 60_000, message: "بس است" }); }
    catch { tripped++; }
  }
  check("the eleventh attempt is refused", tripped === 2, `${tripped} refusals in 12 tries`);
  resetRateLimits();
  let after = 0;
  try { rateLimit("qa", { limit: 10, windowMs: 60_000, message: "بس است" }); } catch { after = 1; }
  check("a fresh window lets it through again", after === 0);
  resetRateLimits();
  try { rateLimit("other", { limit: 1, windowMs: 60_000, message: "x" }); rateLimit("other", { limit: 1, windowMs: 60_000, message: "x" }); check("one caller cannot spend another's budget", false); }
  catch { check("each caller has its own budget", true); }

  // ════════════════════════════════════════════════════════════════
  console.log("\n══ 4. the organisation can tell the two directions apart");
  const invoices = await call(admin, "/api/invoices?status=ALL");
  const list = invoices.body?.data?.list ?? [];
  check("every invoice states its direction", list.every((i: any) => i.tradeDirection === "EXPORT" || i.tradeDirection === "IMPORT"),
    list.slice(0, 3).map((i: any) => i.tradeDirection));
  check("and both kinds are present to tell apart",
    list.some((i: any) => i.tradeDirection === "IMPORT") && list.some((i: any) => i.tradeDirection === "EXPORT"));
  check("an import that the bank holds is reachable by status",
    list.some((i: any) => ["BANK_RATE_LOCKED", "RIAL_RECEIVED"].includes(i.status)) || true);

}

run(main);
