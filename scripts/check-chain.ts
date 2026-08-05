import "dotenv/config";
import { createPublicClient, defineChain, formatEther, formatUnits, http, parseAbi } from "viem";
import { chainProfile } from "../lib/chains";

/**
 * Pre-flight for the chain configuration and the gateway's wallets.
 *
 * Run after changing any CHAIN_* setting or funding a wallet. It answers the
 * two questions that otherwise turn into "why isn't this payment being picked
 * up": is the node the one we think it is, and can the wallets do their job.
 *
 *   npm run check:chain
 */
const ERC20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

let warnings = 0;
const warn = (message: string) => {
  warnings += 1;
  console.warn(`  ! ${message}`);
};

async function main() {
  const chainId = Number(process.env.CHAIN_ID);
  const rpc = process.env.CHAIN_RPC_URL;
  const token = process.env.USDT_CONTRACT_ADDRESS as `0x${string}`;
  if (!rpc) throw new Error("CHAIN_RPC_URL is not set");

  // The chain's own name and coin, not a guess. Reporting a Sepolia wallet's
  // gas balance in BNB is the kind of small lie that costs someone an hour.
  const profile = chainProfile(chainId);
  const gas = profile.nativeSymbol;

  const client = createPublicClient({
    chain: defineChain({
      id: chainId,
      name: profile.enName,
      nativeCurrency: { name: gas, symbol: gas, decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    }),
    transport: http(rpc),
  });

  // ── node ──────────────────────────────────────────────────────────────────
  const reported = await client.getChainId();
  if (reported !== chainId) {
    throw new Error(`CHAIN_ID is ${chainId} but the RPC endpoint reports ${reported}`);
  }
  const head = await client.getBlockNumber();
  console.log(`chain                 : ${reported} (${chainId === 56 ? "mainnet" : "testnet"})`);
  console.log(`head block            : ${head}`);

  // ── finality ──────────────────────────────────────────────────────────────
  const mode = process.env.CHAIN_FINALITY ?? "finalized";
  if (mode === "finalized") {
    try {
      const finalized = await client.getBlock({ blockTag: "finalized" });
      const behind = head - (finalized.number ?? 0n);
      console.log(`finalized block       : ${finalized.number} (${behind} behind head)`);
    } catch {
      warn(
        "CHAIN_FINALITY=finalized but this node does not serve the finalized tag — set CHAIN_FINALITY=confirmations",
      );
    }
  } else {
    console.log(`finality              : ${process.env.CHAIN_MIN_CONFIRMATIONS ?? 15} confirmations`);
  }

  // ── token ─────────────────────────────────────────────────────────────────
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: token, abi: ERC20, functionName: "symbol" }),
    client.readContract({ address: token, abi: ERC20, functionName: "decimals" }),
  ]);
  console.log(`token                 : ${symbol} at ${token}`);

  const configuredDecimals = Number(process.env.USDT_DECIMALS ?? 18);
  if (Number(decimals) !== configuredDecimals) {
    throw new Error(
      `USDT_DECIMALS is ${configuredDecimals} but the contract reports ${decimals} — every amount would be wrong by a factor of 10^${Math.abs(configuredDecimals - Number(decimals))}`,
    );
  }

  // ── log range ─────────────────────────────────────────────────────────────
  const batch = BigInt(process.env.CHAIN_SCAN_BATCH ?? 10);
  try {
    await client.getLogs({ address: token, fromBlock: head - batch + 1n, toBlock: head });
    console.log(`getLogs range         : ${batch} blocks accepted`);
  } catch (error) {
    warn(
      `getLogs rejected a ${batch}-block range — lower CHAIN_SCAN_BATCH (${
        error instanceof Error ? error.message.split("\n")[0] : error
      })`,
    );
  }

  // ── wallets ───────────────────────────────────────────────────────────────
  const { db } = await import("../lib/server/db");
  const wallets = await db.wallet.findMany({
    where: { ownerKind: "BANK" },
    orderBy: { bankKind: "asc" },
  });

  console.log(`\ngateway wallets       : ${wallets.length}`);
  if (wallets.length === 0) {
    warn("none configured — run `npm run db:seed` with SEED_BANK_*_WALLET set");
  }

  for (const wallet of wallets) {
    const address = wallet.address as `0x${string}`;
    const [bnb, balance] = await Promise.all([
      client.getBalance({ address }),
      client.readContract({
        address: token,
        abi: ERC20,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);

    console.log(
      `  ${(wallet.bankKind ?? "?").padEnd(7)} ${address}  ${wallet.active ? "active" : "inactive"}\n` +
        `          ${formatEther(bnb)} ${gas} · ${formatUnits(balance, Number(decimals))} ${symbol}`,
    );

    // A sending wallet has to pay its own gas and hold what it sends; a
    // receiving one needs neither, so only warn where it actually matters.
    if (wallet.active && wallet.bankKind !== "RECEIVE") {
      if (bnb === 0n) {
        warn(`${wallet.bankKind} wallet has no ${gas} — it cannot pay gas to send anything`);
      }
      if (balance === 0n) {
        warn(`${wallet.bankKind} wallet holds no ${symbol} — it has nothing to send`);
      }
    }
  }

  if (!wallets.some((w) => w.active && (w.bankKind === "RECEIVE" || w.bankKind === "SHARED"))) {
    warn("no active RECEIVE wallet — invoices cannot be approved, there is nowhere to quote for payment");
  }

  await db.$disconnect();

  console.log(
    warnings === 0
      ? "\nChain configuration OK."
      : `\nChain reachable, but ${warnings} thing(s) need attention before payments can flow.`,
  );
}

main().catch((error) => {
  console.error("\nChain check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
