import "server-only";
import { createPublicClient, defineChain, formatUnits, http, parseAbi } from "viem";
import { env } from "../env";

/**
 * The chain is defined from environment values rather than viem's presets, so
 * moving from BSC testnet to mainnet is a config change and never a code change.
 */
export function chain() {
  const { CHAIN_ID, CHAIN_RPC_URL, CHAIN_EXPLORER_URL } = env();
  return defineChain({
    id: CHAIN_ID,
    name: CHAIN_ID === 56 ? "BNB Smart Chain" : "BNB Smart Chain Testnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [CHAIN_RPC_URL] } },
    blockExplorers: { default: { name: "BscScan", url: CHAIN_EXPLORER_URL } },
  });
}

let cached: ReturnType<typeof createPublicClient> | null = null;

export function publicClient() {
  if (!cached) {
    cached = createPublicClient({ chain: chain(), transport: http(env().CHAIN_RPC_URL) });
  }
  return cached;
}

/** Only the pieces of BEP-20 the gateway needs to read. */
export const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const TRANSFER_EVENT = ERC20_ABI[0];

export function usdtAddress(): `0x${string}` {
  return env().USDT_CONTRACT_ADDRESS.toLowerCase() as `0x${string}`;
}

/** Normalises an address for storage and comparison. Throws if malformed. */
export function normalizeAddress(input: string): `0x${string}` {
  const value = input.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(value)) {
    throw new Error(`Not a valid EVM address: ${input}`);
  }
  return value as `0x${string}`;
}

export function isAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(input.trim());
}

export function toHuman(raw: bigint, currency: "USDT" | "BNB"): string {
  const decimals = currency === "USDT" ? env().USDT_DECIMALS : 18;
  return formatUnits(raw, decimals);
}

/**
 * The block past which history cannot change.
 *
 * BSC's fast finality makes a finalised block unrevertable, which is a far
 * better signal than counting confirmations on a chain producing a block every
 * half second — 15 confirmations there is seven seconds of protection. Nodes
 * that do not serve the `finalized` tag fall back to counting.
 */
export async function irreversibleBlock(): Promise<bigint> {
  const client = publicClient();
  const { CHAIN_FINALITY, CHAIN_MIN_CONFIRMATIONS } = env();

  if (CHAIN_FINALITY === "finalized") {
    try {
      const block = await client.getBlock({ blockTag: "finalized" });
      if (block?.number != null) return block.number;
    } catch {
      // Fall through to the confirmation count below.
    }
  }

  const head = await client.getBlockNumber();
  const back = BigInt(CHAIN_MIN_CONFIRMATIONS);
  return head > back ? head - back : 0n;
}

export function explorerTxUrl(hash: string) {
  return `${env().CHAIN_EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  return `${env().CHAIN_EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}
