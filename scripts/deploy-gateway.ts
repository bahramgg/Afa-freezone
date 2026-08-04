import "dotenv/config";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import artifacts from "../contracts/artifacts/afa-gateway.json";
import { chainProfile } from "../lib/chains";

/**
 * Deploys the settlement factory.
 *
 * Run once per chain. The key used here only pays for the deployment and
 * becomes the factory owner — it never has custody of anyone's money, because
 * the factory cannot move funds at all. Pass it on the command line so it never
 * has to live in a file:
 *
 *   DEPLOY_PRIVATE_KEY=0x… npm run contracts:deploy
 *
 * The destination wallets and the fee come from the environment, so changing
 * where the money goes is a config change and a redeploy, never a code change.
 */
const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const address = (name: string) => {
  const value = need(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${name} is not an address: ${value}`);
  return value as `0x${string}`;
};

async function main() {
  const chainId = Number(need("CHAIN_ID"));
  const rpc = need("CHAIN_RPC_URL");
  // The floor and ceiling below are amounts of the token, so they are scaled by
  // the token's own decimals. Getting this wrong does not fail loudly — it
  // deploys a contract whose fee bounds are off by a factor of a trillion.
  const decimals = Number(process.env.USDT_DECIMALS ?? 18);

  const profile = chainProfile(chainId);
  const chain = defineChain({
    id: chainId,
    name: profile.name,
    nativeCurrency: { name: profile.nativeSymbol, symbol: profile.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const account = privateKeyToAccount(need("DEPLOY_PRIVATE_KEY") as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });

  const token = address("USDT_CONTRACT_ADDRESS");
  const gatewayWallet = address("GATEWAY_WALLET");
  const freezoneWallet = address("FREEZONE_WALLET");
  const beneficiary = address("BANK_TREASURY_WALLET");

  // Percentages arrive as human numbers and go on chain as basis points.
  const feeBps = Math.round(Number(process.env.GATEWAY_FEE_PERCENT ?? 2) * 100);
  const freezoneBps = Math.round(Number(process.env.FREEZONE_SHARE_PERCENT ?? 50) * 100);
  const feeMin = parseUnits(process.env.GATEWAY_FEE_MIN ?? "1", decimals);
  const feeMax = parseUnits(process.env.GATEWAY_FEE_MAX ?? "500", decimals);

  const distinct = new Set([gatewayWallet, freezoneWallet, beneficiary].map((a) => a.toLowerCase()));
  if (distinct.size < 3) {
    throw new Error(
      "GATEWAY_WALLET, FREEZONE_WALLET and BANK_TREASURY_WALLET must be three different addresses — " +
        "sharing one makes the split impossible to account for afterwards",
    );
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`chain            : ${profile.name} (${chainId})`);
  console.log(`deployer         : ${account.address}  (${formatEther(balance)} ${profile.nativeSymbol})`);
  console.log(`token            : ${token}`);
  console.log(`gateway wallet   : ${gatewayWallet}`);
  console.log(`freezone wallet  : ${freezoneWallet}`);
  console.log(`bank treasury    : ${beneficiary}`);
  console.log(`fee              : ${feeBps / 100}%  (floor ${process.env.GATEWAY_FEE_MIN ?? 1}, ceiling ${process.env.GATEWAY_FEE_MAX ?? 500})`);
  console.log(`organisation cut : ${freezoneBps / 100}% of the fee\n`);

  if (balance === 0n) {
    throw new Error(`the deployer has no ${profile.nativeSymbol} to pay for gas`);
  }

  const hash = await wallet.deployContract({
    abi: artifacts.AfaGatewayFactory.abi,
    bytecode: artifacts.AfaGatewayFactory.bytecode as `0x${string}`,
    args: [token, gatewayWallet, freezoneWallet, beneficiary, feeBps, freezoneBps, feeMin, feeMax],
  });
  console.log(`deploying        : ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error("deployment failed");
  }

  // Proof the deployed contract agrees with what was asked for, before anyone
  // is quoted an address derived from it.
  const sample = (await publicClient.readContract({
    address: receipt.contractAddress,
    abi: artifacts.AfaGatewayFactory.abi,
    functionName: "depositAddressFor",
    args: ["INV-0000"],
  })) as string;

  console.log(`\n✓ factory deployed at ${receipt.contractAddress}`);
  console.log(`  a sample deposit address: ${sample}`);
  console.log(`\nPut this in .env:\n\n  GATEWAY_FACTORY_ADDRESS=${receipt.contractAddress}\n`);
}

main().catch((error) => {
  console.error(`\nDeployment failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
