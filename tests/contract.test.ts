/**
 * The gateway contract, on a real EVM.
 *
 * This contract decides who gets paid, so the questions are: does the address a
 * buyer is given depend only on the terms they were quoted, does the split land
 * where it should, and can anyone — owner included — redirect money that has
 * already arrived.
 */

import { check, gatewayArtifacts, run, tokenDecimals } from "./harness";

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

let artifacts: any;

const local = defineChain({
  id: 31337,
  name: "local",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

// Hardhat's first account — publicly known, local chain only.
const deployer = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
// A second, to prove that releasing needs no privilege at all.
const stranger = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const publicClient = createPublicClient({ chain: local, transport: http() });
const wallet = createWalletClient({ account: deployer, chain: local, transport: http() });
const strangerWallet = createWalletClient({ account: stranger, chain: local, transport: http() });

const GATEWAY = "0x1111111111111111111111111111111111111111";
const FREEZONE = "0x2222222222222222222222222222222222222222";
const BANK = "0x3333333333333333333333333333333333333333";

/** A minimal BEP-20 with the same shape as USDT on BSC, for the test chain. */
const TOKEN_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
contract TestToken {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 v) external { balanceOf[to] += v; }
    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v; balanceOf[to] += v; return true;
    }
}`;

async function compileToken() {
  const solc = (await import("solc")).default;
  const out = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "T.sol": { content: TOKEN_SOURCE } },
        settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
      }),
    ),
  );
  const c = out.contracts["T.sol"].TestToken;
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` as `0x${string}` };
}

async function deploy(artifact: { abi: any; bytecode: string }, args: unknown[]) {
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: args as never,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.contractAddress!;
}

const ERC20 = parseAbi([
  "function mint(address to, uint256 v)",
  "function transfer(address to, uint256 v) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const usdt = (n: string) => parseUnits(n, tokenDecimals());

async function main() {
  artifacts = await gatewayArtifacts();
  const token = await compileToken();
  const tokenAddress = await deploy(token, []);
  const factoryArtifact = artifacts.AfaGatewayFactory;

  console.log("── deploy the factory: 2% fee, 40% of it to the organisation");
  const factory = await deploy(factoryArtifact, [
    tokenAddress,
    GATEWAY,
    FREEZONE,
    BANK,
    200, // feeBps — 2%
    4000, // freezoneBps — 40% of the fee
    usdt("1"), // floor
    usdt("500"), // ceiling
  ]);
  check("factory deployed", Boolean(factory), factory);

  const read = (functionName: string, args: unknown[] = []) =>
    publicClient.readContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName,
      args: args as never,
    });

  const terms = (await read("currentTerms", ["INV-1042"])) as any;
  const address = (await read("depositAddress", [terms])) as `0x${string}`;
  check("a deposit address can be quoted before anything is deployed", /^0x[a-fA-F0-9]{40}$/.test(address), address);

  const nothingThere = await publicClient.getBytecode({ address });
  check("and nothing is deployed there yet", !nothingThere || nothingThere === "0x");

  console.log("── the address depends only on the terms");
  const same = (await read("depositAddress", [terms])) as string;
  check("the same terms give the same address", same === address);

  const otherInvoice = (await read("depositAddressFor", ["INV-1043"])) as string;
  check("a different invoice gives a different address", otherInvoice !== address, { address, otherInvoice });

  const cheaper = (await read("depositAddress", [{ ...terms, feeBps: 100 }])) as string;
  check("a different fee gives a different address", cheaper !== address);

  const redirected = (await read("depositAddress", [{ ...terms, beneficiary: GATEWAY }])) as string;
  check("a different destination gives a different address", redirected !== address);

  console.log("── a buyer pays 1000 to that address");
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: tokenAddress,
      abi: ERC20,
      functionName: "mint",
      args: [address, usdt("1000")],
    }),
  });
  const balanceOf = (who: string) =>
    publicClient.readContract({
      address: tokenAddress,
      abi: ERC20,
      functionName: "balanceOf",
      args: [who as `0x${string}`],
    }) as Promise<bigint>;
  check("the money is sitting at the address", (await balanceOf(address)) === usdt("1000"));

  console.log("── anyone may release it — a stranger does");
  await publicClient.waitForTransactionReceipt({
    hash: await strangerWallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "release",
      args: [terms] as never,
    }),
  });

  check("gateway received 12 (60% of the 20 fee)", (await balanceOf(GATEWAY)) === usdt("12"), (await balanceOf(GATEWAY)).toString());
  check("organisation received 8 (40% of the fee)", (await balanceOf(FREEZONE)) === usdt("8"), (await balanceOf(FREEZONE)).toString());
  check("bank received the remaining 980", (await balanceOf(BANK)) === usdt("980"), (await balanceOf(BANK)).toString());
  check("nothing is stranded at the deposit", (await balanceOf(address)) === 0n);
  check(
    "the three shares add back to what arrived",
    (await balanceOf(GATEWAY)) + (await balanceOf(FREEZONE)) + (await balanceOf(BANK)) === usdt("1000"),
  );

  console.log("── a late top-up to the same address still settles");
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: tokenAddress,
      abi: ERC20,
      functionName: "mint",
      args: [address, usdt("100")],
    }),
  });
  await publicClient.waitForTransactionReceipt({
    hash: await strangerWallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "release",
      args: [terms] as never,
    }),
  });
  check("gateway now has 12 + 1.2", (await balanceOf(GATEWAY)) === usdt("13.2"), (await balanceOf(GATEWAY)).toString());
  check("bank now has 980 + 98", (await balanceOf(BANK)) === usdt("1078"), (await balanceOf(BANK)).toString());

  console.log("── the owner cannot redirect money already paid");
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "setTerms",
      args: [GATEWAY, GATEWAY, GATEWAY, 9000, 10000, 0n, 0n] as never,
    }),
  });
  const beforeGateway = await balanceOf(GATEWAY);

  const second = (await read("depositAddressFor", ["INV-2000"])) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: tokenAddress,
      abi: ERC20,
      functionName: "mint",
      args: [address, usdt("100")],
    }),
  });
  // Released on the ORIGINAL terms, which is what that address is bound to.
  await publicClient.waitForTransactionReceipt({
    hash: await strangerWallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "release",
      args: [terms] as never,
    }),
  });
  check(
    "the old address still splits on its own terms after the owner changed them",
    (await balanceOf(GATEWAY)) === beforeGateway + usdt("1.2"),
    { before: beforeGateway.toString(), now: (await balanceOf(GATEWAY)).toString() },
  );
  check("new invoices do get the new terms", second !== address);

  console.log("── the fee floor and ceiling hold");
  const smallTerms = (await read("currentTerms", ["INV-SMALL"])) as any;
  const fair = { ...smallTerms, feeBps: 200, freezoneBps: 4000, feeMin: usdt("1"), feeMax: usdt("500"), gatewayWallet: GATEWAY, freezoneWallet: FREEZONE, beneficiary: BANK };
  const smallAddress = (await read("depositAddress", [fair])) as `0x${string}`;
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: tokenAddress,
      abi: ERC20,
      functionName: "mint",
      args: [smallAddress, usdt("0.5")],
    }),
  });
  const gatewayBefore = await balanceOf(GATEWAY);
  const bankBefore = await balanceOf(BANK);
  await publicClient.waitForTransactionReceipt({
    hash: await strangerWallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "release",
      args: [fair] as never,
    }),
  });
  const feeTaken = (await balanceOf(GATEWAY)) - gatewayBefore + ((await balanceOf(FREEZONE)) - (await balanceOf(FREEZONE)));
  check(
    "a payment smaller than the fee floor never produces a negative payout",
    (await balanceOf(BANK)) === bankBefore,
    { bankBefore: bankBefore.toString(), bankNow: (await balanceOf(BANK)).toString() },
  );
  check("and the whole of it goes to the fee, not more", feeTaken <= usdt("0.5"), feeTaken.toString());

  console.log("── a stranger cannot change the terms");
  let refused = false;
  try {
    await strangerWallet.writeContract({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "setTerms",
      args: [BANK, BANK, BANK, 0, 0, 0n, 0n] as never,
    });
  } catch {
    refused = true;
  }
  check("setTerms is owner-only", refused);
}

run(main);
