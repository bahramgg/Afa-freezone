import "dotenv/config";

/**
 * What every suite in here shares.
 *
 * These are end-to-end tests, not unit tests: they drive the same HTTP routes
 * the panels drive, against a real Postgres and a real EVM. Nothing is mocked,
 * because the things most worth checking — who is allowed to move a status, how
 * much the contract actually pays out, whether the books agree with the chain —
 * are exactly the things a mock would decide for us.
 *
 * The cost is that a suite needs its world running. `tests/run.ts` checks for
 * that up front and says plainly what is missing rather than letting a suite
 * fail with a connection error.
 */
export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────────────────────── reporting ──

let passed = 0;
let failed = 0;
const problems: string[] = [];

/** Serialises anything a check might hand back, including Prisma's bigints. */
const describe = (detail: unknown) =>
  JSON.stringify(detail ?? null, (_, v) => (typeof v === "bigint" ? v.toString() : v))?.slice(
    0,
    320,
  ) ?? "undefined";

export function check(what: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ✓ ${what}`);
    passed++;
    return true;
  }
  const said = describe(detail);
  console.log(`  ✗ ${what}\n      ${said}`);
  failed++;
  problems.push(`${what} — ${said}`);
  return false;
}

/** A heading, so a failing line can be traced back to what was being done. */
export function step(title: string) {
  console.log(`\n── ${title}`);
}

/**
 * Ends the suite.
 *
 * The `##RESULT` line is what `tests/run.ts` reads to total the run up; the
 * human-readable lines around it are for whoever is running one suite on its
 * own.
 */
export function summary() {
  if (problems.length) {
    console.log("\nfailures:");
    for (const p of problems) console.log(`  · ${p}`);
  }
  console.log(`\n##RESULT pass=${passed} fail=${failed}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

/**
 * Runs a suite and always leaves a verdict behind.
 *
 * A suite that throws half way through has still learned something, and the
 * checks it managed are worth printing. Losing them to an unhandled rejection —
 * and worse, to a `##RESULT` line the runner never sees — turns a specific
 * failure into "the suite crashed".
 */
export async function run(suite: () => Promise<void>) {
  try {
    await suite();
  } catch (error) {
    check("the suite ran to the end", false, error instanceof Error ? error.message : error);
  } finally {
    const { db } = await import("@/lib/server/db");
    await db.$disconnect().catch(() => {});
    summary();
  }
}

/** Distinguishes this run's fixtures from every previous run's leftovers. */
export const runId = Date.now().toString(36);
export const unique = (prefix: string) => `${prefix}.${runId}.${Math.random().toString(36).slice(2, 7)}`;

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────────────────────────────────────────── the API ──

/** One caller's cookies. Sessions are the only way scope is ever established. */
export type Jar = { cookie: string };
export const jar = (): Jar => ({ cookie: "" });

export type Reply<T = any> = { status: number; body: T; text: string };

export async function call<T = any>(j: Jar, path: string, init?: RequestInit): Promise<Reply<T>> {
  const res = await fetch(BASE + path, {
    ...init,
    // A redirect is an answer worth seeing — following it hides which guard
    // fired and where it sent the caller.
    redirect: "manual",
    headers: { "content-type": "application/json", cookie: j.cookie, ...(init?.headers ?? {}) },
  });
  for (const c of res.headers.getSetCookie()) {
    if (c.startsWith("afa_session=")) j.cookie = c.split(";")[0];
  }
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as T, text };
  } catch {
    return { status: res.status, body: null as T, text };
  }
}

export const get = <T = any>(j: Jar, p: string) => call<T>(j, p);
export const post = <T = any>(j: Jar, p: string, b: unknown = {}) =>
  call<T>(j, p, { method: "POST", body: JSON.stringify(b) });
export const patch = <T = any>(j: Jar, p: string, b: unknown = {}) =>
  call<T>(j, p, { method: "PATCH", body: JSON.stringify(b) });
export const del = <T = any>(j: Jar, p: string) => call<T>(j, p, { method: "DELETE" });

/**
 * Signs in the way a person does: ask for a code, then type it.
 *
 * Outside production the route hands the code straight back, so no mailbox is
 * involved. The resend cooldown is real and worth keeping, so when a previous
 * suite has just asked for a code for this address the only honest thing to do
 * is wait it out rather than weaken the protection for the tests' convenience.
 */
export async function signIn(j: Jar, email: string) {
  let req = await post(j, "/api/auth/otp/request", { email });
  if (req.body?.error?.code === "too_many_requests") {
    const seconds = Number(/(\d+)/.exec(req.body.error.message ?? "")?.[1] ?? 60);
    console.log(`     waiting ${seconds}s on the sign-in cooldown for ${email}…`);
    await wait((seconds + 2) * 1000);
    req = await post(j, "/api/auth/otp/request", { email });
  }
  const code = req.body?.data?.devCode;
  if (!code) throw new Error(`no sign-in code for ${email}: ${describe(req.body)}`);
  const verified = await post(j, "/api/auth/otp/verify", { email, code });
  if (!verified.body?.ok) throw new Error(`sign-in refused for ${email}: ${describe(verified.body)}`);
  return verified;
}

/** A session cookie value, for callers that are not using a jar — a browser. */
export async function sessionCookie(email: string) {
  const j = jar();
  await signIn(j, email);
  return j.cookie.split("=").slice(1).join("=");
}

// ─────────────────────────────────────────────────────────── seeded people ──

/**
 * The accounts `prisma/seed.ts` creates. A suite that needs a fresh person
 * registers one; a suite that needs an operator uses these.
 */
export const STAFF = {
  admin: process.env.SEED_ADMIN_EMAIL ?? "admin@afa.local",
  bank: process.env.SEED_BANK_EMAIL ?? "bank@afa.local",
  system: process.env.SEED_SYSTEM_EMAIL ?? "system@afa.local",
  merchant: process.env.SEED_MERCHANT_EMAIL ?? "merchant@afa.local",
} as const;

// ─────────────────────────────────────────────────────────────── the chain ──

export { db } from "@/lib/server/db";

export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 31337);
export const RPC = process.env.LOCAL_CHAIN_RPC ?? "http://127.0.0.1:8545";

/**
 * Hardhat's first two accounts. Publicly known keys on a throwaway chain — the
 * gateway itself holds no key to anything, which is half of what these suites
 * exist to prove.
 */
export const OPERATOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const STRANGER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/** Only what the gateway ever calls on a token. */
export const TOKEN_ABI = [
  "function mint(address,uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

export const tokenAddress = () => process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
export const factoryAddress = () => process.env.GATEWAY_FACTORY_ADDRESS as `0x${string}`;

/** Loaded lazily so a suite that never touches the chain never needs viem. */
export async function chain() {
  const { createPublicClient, createWalletClient, defineChain, http, parseAbi, formatUnits, parseUnits } =
    await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  const definition = defineChain({
    id: CHAIN_ID,
    name: "local",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC] } },
  });

  const operator = privateKeyToAccount(OPERATOR_KEY);
  const stranger = privateKeyToAccount(STRANGER_KEY);
  const publicClient = createPublicClient({ chain: definition, transport: http() });
  const wallet = createWalletClient({ account: operator, chain: definition, transport: http() });
  const strangerWallet = createWalletClient({ account: stranger, chain: definition, transport: http() });
  const erc20 = parseAbi(TOKEN_ABI);

  const balanceOf = async (who: string) =>
    formatUnits(
      (await publicClient.readContract({
        address: tokenAddress(),
        abi: erc20,
        functionName: "balanceOf",
        args: [who as `0x${string}`],
      })) as bigint,
      18,
    );

  const mint = async (to: string, amount: string) => {
    const hash = await wallet.writeContract({
      address: tokenAddress(),
      abi: erc20,
      functionName: "mint",
      args: [to as `0x${string}`, parseUnits(amount, 18)],
    });
    return publicClient.waitForTransactionReceipt({ hash });
  };

  const transfer = async (to: string, amount: string) => {
    const hash = await wallet.writeContract({
      address: tokenAddress(),
      abi: erc20,
      functionName: "transfer",
      args: [to as `0x${string}`, parseUnits(amount, 18)],
    });
    return publicClient.waitForTransactionReceipt({ hash });
  };

  /**
   * Moves the head past the confirmation threshold and lets the watcher see it.
   *
   * The sleep is not padding. viem caches `getBlockNumber` for a few seconds, so
   * a watcher pass fired immediately after mining reads a stale head, decides
   * the deposit is not yet buried deep enough, and leaves it pending — which
   * looks exactly like a bug in the watcher and is not one.
   */
  const settle = async () => {
    await publicClient.waitForTransactionReceipt({
      hash: await wallet.sendTransaction({ to: operator.address, value: 0n }),
    });
    await wait(5000);
    const { runWatcher } = await import("@/lib/server/chain/watcher");
    await runWatcher();
  };

  return {
    definition,
    operator,
    stranger,
    publicClient,
    wallet,
    strangerWallet,
    erc20,
    balanceOf,
    mint,
    transfer,
    settle,
    parseUnits,
    formatUnits,
  };
}

/** The compiled gateway contract — the bytecode every deposit address commits to. */
export async function gatewayArtifacts() {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  return JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../contracts/artifacts/afa-gateway.json"), "utf8"),
  );
}
