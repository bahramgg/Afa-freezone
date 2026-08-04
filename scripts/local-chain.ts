import "dotenv/config";
import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import artifacts from "../contracts/artifacts/afa-gateway.json";

/**
 * Puts a local chain into a state the test suites can run against.
 *
 * A hardhat node keeps nothing across restarts, so every time one comes back it
 * is an empty chain with none of the contracts the app was configured for. This
 * deploys a token and the settlement factory onto it and writes both addresses
 * into `.env`.
 *
 * The factory's address is not incidental: deposit addresses are derived from
 * it, so a redeployed factory moves every address the app would quote. Existing
 * invoices keep pointing at addresses on a chain that no longer exists — which
 * is fine for a throwaway node and would be a catastrophe anywhere else. This
 * refuses to run against anything but a local chain for that reason.
 *
 *   npx hardhat node &
 *   npm run chain:local
 */
const RPC = process.env.LOCAL_CHAIN_RPC ?? "http://127.0.0.1:8545";
const LOCAL_CHAIN_ID = 31337;

/** Hardhat's first account. Public, funded, and worthless outside this node. */
const DEPLOYER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const chain = defineChain({
  id: LOCAL_CHAIN_ID,
  name: "hardhat",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const account = privateKeyToAccount(DEPLOYER);
const pub = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account, chain, transport: http() });

/**
 * A BEP-20 shaped like USDT on BSC, minus everything the gateway never calls.
 *
 * `Transfer` is the point — it is the event the deposit watcher scans for, and
 * a payment is only ever recognised because one of these was emitted.
 */
const TOKEN_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract TestToken {
    mapping(address => uint256) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint256 value);
    function mint(address to, uint256 v) external { balanceOf[to] += v; emit Transfer(address(0), to, v); }
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v; balanceOf[to] += v; emit Transfer(msg.sender, to, v); return true;
    }
}`;

const envPath = resolve(import.meta.dirname, "../.env");
const readEnv = (key: string) =>
  new RegExp(`^${key}=(.*)$`, "m").exec(readFileSync(envPath, "utf8"))?.[1]?.trim() ?? "";

async function main() {
  const decimals = Number(readEnv("USDT_DECIMALS") || 18);
  const live = await pub.getChainId();
  if (live !== LOCAL_CHAIN_ID) {
    throw new Error(
      `${RPC} is chain ${live}, not ${LOCAL_CHAIN_ID}. This rewrites .env and moves every ` +
        `deposit address — it only runs against a local node.`,
    );
  }

  const solc = (await import("solc")).default;
  const out = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "T.sol": { content: TOKEN_SOURCE } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const token_ = out.contracts["T.sol"].TestToken;

  const tokenHash = await wallet.deployContract({
    abi: token_.abi,
    bytecode: `0x${token_.evm.bytecode.object}` as `0x${string}`,
    args: [],
  });
  const token = (await pub.waitForTransactionReceipt({ hash: tokenHash })).contractAddress!;
  console.log("token   :", token);

  // The factory's constructor arguments are part of its bytecode's deployment,
  // and the terms each deposit address commits to come from them. Reading the
  // same values the app reads keeps the two descriptions of the split in step.
  const factoryHash = await wallet.deployContract({
    abi: artifacts.AfaGatewayFactory.abi,
    bytecode: artifacts.AfaGatewayFactory.bytecode as `0x${string}`,
    args: [
      token,
      readEnv("GATEWAY_WALLET"),
      readEnv("FREEZONE_WALLET"),
      readEnv("BANK_TREASURY_WALLET"),
      Math.round(Number(readEnv("GATEWAY_FEE_PERCENT") || 2) * 100),
      Math.round(Number(readEnv("FREEZONE_SHARE_PERCENT") || 50) * 100),
      // The floor and the ceiling are token units, so they follow the token's
      // decimals and not the native coin's. Hardcoding 18 here put the floor a
      // trillion times too high the moment USDT_DECIMALS became 6, and nothing
      // said so — the contract simply charged the ceiling on every payment.
      parseUnits(readEnv("GATEWAY_FEE_MIN") || "1", decimals),
      parseUnits(readEnv("GATEWAY_FEE_MAX") || "500", decimals),
    ] as never,
  });
  const factory = (await pub.waitForTransactionReceipt({ hash: factoryHash })).contractAddress!;
  console.log("factory :", factory);

  let file = readFileSync(envPath, "utf8");
  file = file.replace(/^USDT_CONTRACT_ADDRESS=.*$/m, `USDT_CONTRACT_ADDRESS=${token.toLowerCase()}`);
  file = file.replace(
    /^GATEWAY_FACTORY_ADDRESS=.*$/m,
    `GATEWAY_FACTORY_ADDRESS=${factory.toLowerCase()}`,
  );
  writeFileSync(envPath, file);
  console.log("\n.env updated — restart the dev server so it reads the new addresses");

  // The watcher remembers how far it has scanned. A node that restarted at
  // block zero is behind that mark, so without this it would sit waiting for a
  // head it already believes it passed.
  const { db } = await import("../lib/server/db");
  const { count } = await db.chainCursor.deleteMany({ where: { chainId: LOCAL_CHAIN_ID } });
  if (count) console.log("scan cursor cleared");
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
