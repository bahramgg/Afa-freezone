import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { chainProfile } from "../lib/chains";

/**
 * One real export, start to finish, on whatever public test chain is configured.
 *
 * Everything `npm test` proves runs against a local node that finalises on
 * demand. This is the part none of it covers: `CHAIN_FINALITY=finalized` asking
 * a real node for a real finalised head, and waiting the real interval out —
 * about eighteen minutes on Sepolia, which is why this is a script you run
 * deliberately rather than a suite.
 *
 *   MNEMONIC="…" npm run walk:live
 *
 * The mnemonic funds gas and plays the buyer. It never enters the app's
 * environment, and the script refuses any chain whose money is real: it mints
 * itself the tokens it pays with.
 */
const BASE = "http://localhost:3000";
const ERC20 = parseAbi([
  "function mint(address,uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

type Reply = { status: number; body: any };
const jar = () => ({ cookie: "" });

async function call(j: { cookie: string }, path: string, init: RequestInit = {}): Promise<Reply> {
  const res: Response = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      ...(j.cookie ? { cookie: j.cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const set = res.headers.get("set-cookie");
  if (set) j.cookie = set.split(";")[0]!;
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: res.status, body };
}

type Jar = { cookie: string };
const post = (j: Jar, p: string, b: unknown) =>
  call(j, p, { method: "POST", body: JSON.stringify(b) });

async function signIn(j: Jar, email: string) {
  const req = await post(j, "/api/auth/otp/request", { email });
  const code = req.body?.data?.devCode;
  if (!code) throw new Error(`no code for ${email}: ${JSON.stringify(req.body)}`);
  const done = await post(j, "/api/auth/otp/verify", { email, code });
  if (!done.body?.ok) throw new Error(`sign-in refused: ${JSON.stringify(done.body)}`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(what: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${what}`);
  } else {
    fail++;
    console.log(`  ✗ ${what}`);
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
  }
}

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};

async function main() {
  const rpc = need("CHAIN_RPC_URL");
  const id = Number(need("CHAIN_ID"));
  const decimals = Number(process.env.USDT_DECIMALS ?? 6);
  // Big enough that the percentage beats the floor — the first walk paid 25,
  // where GATEWAY_FEE_MIN dominated and the percentage branch never ran.
  const AMOUNT = 100;
  const token = process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
  const p = chainProfile(id);
  if (!p.testnet) {
    throw new Error(
      `CHAIN_ID ${id} is not a test network. This mints its own tokens and pays ` +
        `itself — there is nothing here worth running against real money.`,
    );
  }
  const chain = defineChain({
    id,
    name: p.enName,
    nativeCurrency: { name: p.nativeSymbol, symbol: p.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const buyerAccount = mnemonicToAccount(need("MNEMONIC"), { addressIndex: 0 });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const w = createWalletClient({ account: buyerAccount, chain, transport: http(rpc) });
  const bal = async (a: string) =>
    formatUnits(
      (await pub.readContract({
        address: token,
        abi: ERC20,
        functionName: "balanceOf",
        args: [a as `0x${string}`],
      })) as bigint,
      decimals,
    );

  console.log(`── ${p.enName} (${id}), token ${token}\n`);

  const admin = jar();
  const merchant = jar();
  const buyer = jar();
  await signIn(admin, process.env.SEED_ADMIN_EMAIL ?? "admin@afa.local");

  // The merchant: created by signing in, profile filled, KYC approved.
  await signIn(merchant, "merchant@afa.local");
  await call(merchant, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ fullName: "بازرگان نمونه", nationalId: "0012345678" }),
  });
  const me = await call(merchant, "/api/auth/me", {});
  const merchantUid = me.body?.data?.user?.uid;
  await post(admin, `/api/admin/kyc/${merchantUid}`, { action: "approve" });
  check("the merchant is approved", !!merchantUid, merchantUid);

  const buyerEmail = `sepolia.buyer.${Date.now()}@example.com`;
  const reg = await post(buyer, "/api/auth/register", {
    fullName: "Sepolia Buyer Ltd",
    email: buyerEmail,
    passportNo: "SP1",
    country: "Türkiye",
  });
  const buyerUid = reg.body?.data?.user?.uid;
  check("a foreign buyer is registered", !!buyerUid, reg.body);

  console.log("\n── an export invoice, approved");
  const created = await post(merchant, "/api/invoices", {
    amount: AMOUNT,
    currency: "USDT",
    description: "آزمون سرتاسری روی سپولیا",
    goodsTitle: "کالای آزمایشی",
    counterpartyUid: buyerUid,
  });
  const ref = created.body?.data?.invoice?.id;
  check("invoice created", !!ref, created.body);

  const approved = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
  const address = approved.body?.data?.invoice?.paymentAddress as string;
  check("a deposit address was derived", /^0x[0-9a-f]{40}$/.test(address ?? ""), approved.body);
  console.log(`     ${address}`);

  console.log("\n── the buyer pays it, on chain");
  const mint = await w.writeContract({
    address: token,
    abi: ERC20,
    functionName: "mint",
    args: [buyerAccount.address, parseUnits(String(AMOUNT), decimals)],
  });
  await pub.waitForTransactionReceipt({ hash: mint });
  const paid = await w.writeContract({
    address: token,
    abi: ERC20,
    functionName: "transfer",
    args: [address as `0x${string}`, parseUnits(String(AMOUNT), decimals)],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: paid });
  console.log(`     ${paid} in block ${receipt.blockNumber}`);
  check("the money is at the address", Number(await bal(address)) === AMOUNT, await bal(address));

  const { runWatcher } = await import("../lib/server/chain/watcher");

  console.log("\n── the watcher sees it before it is final");
  const first = await runWatcher();
  console.log(`     scanned ${first.fromBlock}..${first.toBlock}, ${first.depositsRecorded} deposit(s)`);
  const { db } = await import("../lib/server/db");
  const seen = await db.invoice.findUnique({ where: { ref } });
  check("recorded as in flight, not credited", Number(seen?.pendingAmount) === AMOUNT, {
    pending: seen?.pendingAmount?.toString(),
    received: seen?.receivedAmount?.toString(),
    status: seen?.status,
  });

  console.log("\n── waiting for the finalised head to pass that block");
  const started = Date.now();
  let settled = false;
  // Sepolia finalises two epochs back; anything over half an hour means the
  // chain itself is unwell, not the gateway.
  while (Date.now() - started < 45 * 60_000) {
    await wait(60_000);
    const report = await runWatcher();
    const now = await db.invoice.findUnique({ where: { ref } });
    const mins = Math.round((Date.now() - started) / 60_000);
    console.log(
      `     +${mins}m  status=${now?.status}  pending=${now?.pendingAmount}  received=${now?.receivedAmount ?? "—"}${report.scanSkipped ? "  (scan skipped)" : ""}`,
    );
    if (now?.status === "PAID") {
      settled = true;
      console.log(`     finalised after ${mins} minute(s)`);
      break;
    }
    if (now?.status === "EXPIRED") break;
  }
  check("the invoice settled once the block finalised", settled);

  const final = await db.invoice.findUnique({ where: { ref } });
  check("credited the confirmed amount", Number(final?.receivedAmount) === AMOUNT, {
    received: final?.receivedAmount?.toString(),
  });
  check("nothing left in flight", Number(final?.pendingAmount) === 0, {
    pending: final?.pendingAmount?.toString(),
  });
  // Derived from the terms the address was built from, not assumed: the fee is
  // a percentage with a floor and a ceiling, and the first walk failed here
  // only because the script forgot the floor the contract did not.
  const pct = Number(process.env.GATEWAY_FEE_PERCENT ?? 2);
  const floor = Number(process.env.GATEWAY_FEE_MIN ?? 0);
  const ceiling = Number(process.env.GATEWAY_FEE_MAX ?? Infinity);
  const share = Number(process.env.FREEZONE_SHARE_PERCENT ?? 50) / 100;
  const expectFee = Math.min(ceiling, Math.max(floor, (AMOUNT * pct) / 100));
  const expectFz = Math.round(expectFee * share * 1e6) / 1e6;
  const expectGw = Math.round((expectFee - expectFz) * 1e6) / 1e6;
  const expectNet = Math.round((AMOUNT - expectFee) * 1e6) / 1e6;
  console.log(`     terms: ${pct}% floor ${floor} ceiling ${ceiling}, organisation ${share * 100}% of the fee`);
  check(`the fee is ${expectFee}`, Number(final?.feeAmount) === expectFee, final?.feeAmount?.toString());

  console.log("\n── the operator releases it: one transaction, three destinations");
  const deposit = await db.depositAddress.findFirst({ where: { invoice: { ref } } });
  const terms = deposit!.terms as Record<string, string>;
  const { default: artifacts } = await import("../contracts/artifacts/afa-gateway.json", {
    with: { type: "json" },
  });

  const before = {
    gw: await bal(terms.gatewayWallet!),
    fz: await bal(terms.freezoneWallet!),
    bank: await bal(terms.beneficiary!),
  };

  const release = await w.writeContract({
    address: process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`,
    abi: artifacts.AfaGatewayFactory.abi,
    functionName: "release",
    args: [
      {
        invoiceRef: terms.invoiceRef,
        feeBps: Number(terms.feeBps),
        freezoneBps: Number(terms.freezoneBps),
        feeMin: BigInt(terms.feeMin!),
        feeMax: BigInt(terms.feeMax!),
        token: terms.token,
        gatewayWallet: terms.gatewayWallet,
        freezoneWallet: terms.freezoneWallet,
        beneficiary: terms.beneficiary,
      },
    ] as never,
  });
  await pub.waitForTransactionReceipt({ hash: release });
  console.log(`     ${release}`);

  const d = (after: string, was: string) => Math.round((Number(after) - Number(was)) * 1e6) / 1e6;
  const gwGot = d(await bal(terms.gatewayWallet!), before.gw);
  const fzGot = d(await bal(terms.freezoneWallet!), before.fz);
  const bankGot = d(await bal(terms.beneficiary!), before.bank);

  check(`the gateway took ${expectGw}`, gwGot === expectGw, gwGot);
  check(`the organisation took ${expectFz}`, fzGot === expectFz, fzGot);
  check(`the seller received ${expectNet}`, bankGot === expectNet, bankGot);
  check("the address is empty", Number(await bal(address)) === 0, await bal(address));
  check(`and it all adds back to ${AMOUNT}`, gwGot + fzGot + bankGot === AMOUNT, gwGot + fzGot + bankGot);

  console.log(`\n${"─".repeat(50)}\n${pass} passed · ${fail} failed`);
  await db.$disconnect();
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
