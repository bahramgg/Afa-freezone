import "dotenv/config";
import { createPublicClient, defineChain, http, parseAbi } from "viem";

/**
 * Connectivity probe for the configured chain. Run with `npm run check:chain`
 * after changing CHAIN_* settings to confirm the RPC endpoint answers and the
 * USDT contract at the configured address is really a token contract.
 */
async function main() {
  const chainId = Number(process.env.CHAIN_ID);
  const rpc = process.env.CHAIN_RPC_URL!;
  const token = process.env.USDT_CONTRACT_ADDRESS! as `0x${string}`;

  const client = createPublicClient({
    chain: defineChain({
      id: chainId,
      name: chainId === 56 ? "BNB Smart Chain" : "BNB Smart Chain Testnet",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    }),
    transport: http(rpc),
  });

  const reported = await client.getChainId();
  if (reported !== chainId) {
    throw new Error(`CHAIN_ID is ${chainId} but the RPC endpoint reports ${reported}`);
  }
  console.log(`chain id            : ${reported}`);

  const head = await client.getBlockNumber();
  console.log(`head block          : ${head}`);

  const decimals = await client.readContract({
    address: token,
    abi: parseAbi(["function decimals() view returns (uint8)"]),
    functionName: "decimals",
  });
  console.log(`USDT contract       : ${token}`);
  console.log(`USDT decimals       : ${decimals}`);

  const configured = Number(process.env.USDT_DECIMALS ?? 18);
  if (Number(decimals) !== configured) {
    throw new Error(
      `USDT_DECIMALS is ${configured} but the contract reports ${decimals} — amounts would be wrong by 10^${Math.abs(configured - Number(decimals))}`,
    );
  }

  console.log("\nChain configuration OK.");
}

main().catch((error) => {
  console.error("\nChain check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
