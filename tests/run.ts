import "dotenv/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

/**
 * Runs the suites and totals them up.
 *
 * Each suite gets its own process. They keep their counters at module scope and
 * several of them move global settings around, so sharing one process would let
 * a suite's leftovers decide another suite's result — which is the one failure
 * mode a test runner must not have.
 *
 *   npm test                  everything whose world is up
 *   npm test -- import        only suites whose name matches
 *   npm test -- --list        what there is
 */
type Need = "server" | "db" | "chain" | "browser";

type Suite = {
  file: string;
  title: string;
  needs: Need[];
};

/**
 * Ordered deliberately: the contract first, because if the thing that decides
 * where money goes is wrong nothing after it means anything; the browser walks
 * last, since they are the slowest and depend on data the flows leave behind.
 */
const SUITES: Suite[] = [
  { file: "contract.test.ts", title: "the settlement contract", needs: ["chain"] },
  { file: "integration.test.ts", title: "the contract, wired to the system", needs: ["chain", "db"] },
  { file: "ledger.test.ts", title: "the books", needs: ["server", "db", "chain"] },
  { file: "checkout.test.ts", title: "the public checkout", needs: ["server", "db", "chain"] },
  { file: "export-flow.test.ts", title: "export, addressed to a buyer", needs: ["server", "db"] },
  { file: "import-flow.test.ts", title: "import, end to end", needs: ["server", "db", "chain"] },
  { file: "import-fixes.test.ts", title: "what an import settles on", needs: ["server", "db", "chain"] },
  { file: "fee-authority.test.ts", title: "who decides the fee", needs: ["server", "db", "chain"] },
  { file: "phase3.test.ts", title: "documents, refunds, and the retired flow", needs: ["server", "db", "chain"] },
  { file: "email-login.test.ts", title: "one email door for every panel", needs: ["server", "db"] },
  { file: "hardening.test.ts", title: "the edges money escapes through", needs: ["server", "db", "chain"] },
  { file: "qa-flows.test.ts", title: "both trade flows, step by step", needs: ["server", "db", "chain"] },
  { file: "login.test.ts", title: "signing in, in a browser", needs: ["server", "db", "browser"] },
  { file: "pages.test.ts", title: "every page of every panel", needs: ["server", "db", "browser"] },
  { file: "direction.test.ts", title: "direction on screen", needs: ["server", "db", "browser"] },
  { file: "import-browser.test.ts", title: "import, walked in a browser", needs: ["server", "db", "browser"] },
  { file: "retired-flow.test.ts", title: "the retired flow is gone", needs: ["server", "db", "browser"] },
];

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const RPC = process.env.LOCAL_CHAIN_RPC ?? "http://127.0.0.1:8545";

// ────────────────────────────────────────────────────────────────── preflight ──

/**
 * What is up, and what is not.
 *
 * A suite that cannot reach its world fails with a connection error, which
 * reads like a broken system and is not one. Checking first means the answer is
 * "the dev server is not running" rather than sixty red lines.
 */
async function available(): Promise<Record<Need, string | true>> {
  const reachable = async (url: string, init?: RequestInit) => {
    try {
      await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
      return true as const;
    } catch (error) {
      return String(error instanceof Error ? error.message : error);
    }
  };

  const server = await reachable(`${BASE}/api/auth/me`);

  const chain = await (async () => {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId" }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (!res) return `no node at ${RPC} — run \`npx hardhat node\` then \`npm run chain:local\``;
    const id = Number((await res.json())?.result ?? 0);
    const expected = Number(process.env.CHAIN_ID ?? 31337);
    if (id !== expected) return `${RPC} is chain ${id}, but CHAIN_ID is ${expected}`;
    return true as const;
  })();

  const db = await (async () => {
    try {
      const { db } = await import("@/lib/server/db");
      await db.$queryRaw`select 1`;
      await db.$disconnect();
      return true as const;
    } catch (error) {
      return `database unreachable: ${error instanceof Error ? error.message : error}`;
    }
  })();

  const browser = await (async () => {
    try {
      await import("playwright");
    } catch {
      return "playwright is not installed — `npm install`";
    }
    const { existsSync } = await import("node:fs");
    const path = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
    return existsSync(path) ? (true as const) : `no chromium at ${path} — set CHROMIUM_PATH`;
  })();

  return {
    server: server === true ? true : `dev server unreachable at ${BASE} — run \`npm run dev\` (${server})`,
    db,
    chain,
    browser,
  };
}

// ─────────────────────────────────────────────────────────────────── running ──

/**
 * How long one suite may take before it is treated as hung.
 *
 * Generous: the browser walks open thirty pages and wait for each to settle,
 * and a suite that signs in during another's cooldown waits a minute out on
 * purpose. But not unbounded — a suite that never returns would hang the whole
 * run silently, which is indistinguishable from a slow one only until someone
 * gives up on it.
 */
const SUITE_TIMEOUT_MS = Number(process.env.TEST_SUITE_TIMEOUT_MS ?? 15 * 60_000);

function runSuite(suite: Suite): Promise<{ pass: number; fail: number; code: number }> {
  return new Promise((done) => {
    const child = spawn(
      "npx",
      ["tsx", "--conditions=react-server", resolve(import.meta.dirname, suite.file)],
      { stdio: ["ignore", "pipe", "inherit"], cwd: resolve(import.meta.dirname, "..") },
    );

    let tail = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      tail += text;
      if (tail.length > 4000) tail = tail.slice(-4000);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      console.log(`\n  ✗ ${suite.file} did not finish within ${SUITE_TIMEOUT_MS / 60_000} minutes`);
      child.kill("SIGKILL");
    }, SUITE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      const hit = timedOut ? null : /##RESULT pass=(\d+) fail=(\d+)/.exec(tail);
      done({
        pass: hit ? Number(hit[1]) : 0,
        // A suite that died before reporting counts as one failure, not zero —
        // a crash must never total up as a clean run.
        fail: hit ? Number(hit[2]) : 1,
        code: code ?? 1,
      });
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--list")) {
    for (const s of SUITES) console.log(`${s.file.padEnd(28)} ${s.title}  [${s.needs.join(", ")}]`);
    return;
  }

  const filters = argv.filter((a) => !a.startsWith("-"));
  const chosen = filters.length
    ? SUITES.filter((s) => filters.some((f) => s.file.includes(f) || s.title.includes(f)))
    : SUITES;

  if (!chosen.length) {
    console.log(`nothing matches ${filters.join(", ")} — try \`npm test -- --list\``);
    process.exitCode = 1;
    return;
  }

  const world = await available();
  for (const [need, state] of Object.entries(world)) {
    console.log(state === true ? `  ✓ ${need}` : `  ✗ ${need}: ${state}`);
  }

  // A full run signs in dozens of times, and every sign-in is an email. Against
  // a real provider that is money spent and reputation risked on addresses
  // nobody reads — and half of them are `.local`, which a provider will refuse
  // outright. The code comes back in the response either way, so `console` is
  // the only sensible setting for a test run.
  if ((process.env.EMAIL_PROVIDER ?? "console") !== "console") {
    console.log(
      `\n  ! EMAIL_PROVIDER is "${process.env.EMAIL_PROVIDER}" — this run will send real email.` +
        `\n    Set EMAIL_PROVIDER=console and restart the dev server first.`,
    );
  }

  const runnable = chosen.filter((s) => s.needs.every((n) => world[n] === true));
  const skipped = chosen.filter((s) => !runnable.includes(s));

  let pass = 0;
  let fail = 0;
  const failing: string[] = [];

  for (const suite of runnable) {
    console.log(`\n\x1b[1m══ ${suite.title}\x1b[0m  (${suite.file})`);
    const result = await runSuite(suite);
    pass += result.pass;
    fail += result.fail;
    if (result.fail > 0) failing.push(`${suite.file} — ${result.fail} failed`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`${runnable.length} suites · ${pass} passed · ${fail} failed`);

  // Skipping is reported as loudly as failing. A run that silently covered a
  // third of the system and exited zero is worse than one that failed.
  if (skipped.length) {
    console.log(`\n${skipped.length} suites did not run:`);
    for (const suite of skipped) {
      const missing = suite.needs.filter((n) => world[n] !== true);
      console.log(`  · ${suite.file} — needs ${missing.join(", ")}`);
    }
  }
  if (failing.length) {
    console.log("\nfailing suites:");
    for (const line of failing) console.log(`  · ${line}`);
  }

  // Nothing ran at all is a failure of the run, whatever the reason.
  process.exitCode = fail > 0 || runnable.length === 0 ? 1 : 0;
}

main();
