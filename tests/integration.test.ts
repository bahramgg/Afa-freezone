/**
 * The contract, wired to the system.
 *
 * Deploys a factory on the local chain, approves an invoice against it, pays
 * the address it quotes, releases it, and checks that the money split three
 * ways and that the books say what the chain says.
 */

import { check, gatewayArtifacts, run } from "./harness";

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

const deployer = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const publicClient = createPublicClient({ chain: local, transport: http() });
const wallet = createWalletClient({ account: deployer, chain: local, transport: http() });

const GATEWAY = "0x08b578c1991369438eaca2baa39832969e11151a";
const FREEZONE = "0x0929d5233047eb9c03def73359f6814dad6c4f6a";
const BANK = "0x08840fd166f58d0353580b817aad8067186446c6";

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

const ERC20 = parseAbi([
  "function mint(address to, uint256 v)",
  "function balanceOf(address) view returns (uint256)",
]);
const usdt = (n: string) => parseUnits(n, 18);

async function deploy(abi: unknown, bytecode: string, args: unknown[]) {
  const hash = await wallet.deployContract({
    abi: abi as never,
    bytecode: bytecode as `0x${string}`,
    args: args as never,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.contractAddress!;
}

async function main() {
  artifacts = await gatewayArtifacts();
  // ── a token and a factory on the local chain ────────────────────────────
  const solc = (await import("solc")).default;
  const compiled = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "T.sol": { content: TOKEN_SOURCE } },
        settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
      }),
    ),
  ).contracts["T.sol"].TestToken;

  const token = await deploy(compiled.abi, `0x${compiled.evm.bytecode.object}`, []);
  const factory = await deploy(
    artifacts.AfaGatewayFactory.abi,
    artifacts.AfaGatewayFactory.bytecode,
    [token, GATEWAY, FREEZONE, BANK, 200, 4000, usdt("1"), usdt("500")],
  );
  console.log(`── factory ${factory} on the local chain`);

  // The server must talk to this chain and this factory.
  process.env.CHAIN_ID = "31337";
  process.env.CHAIN_RPC_URL = "http://127.0.0.1:8545";
  process.env.USDT_CONTRACT_ADDRESS = token;
  process.env.GATEWAY_FACTORY_ADDRESS = factory;
  process.env.CHAIN_FINALITY = "confirmations";
  process.env.CHAIN_MIN_CONFIRMATIONS = "1";

  const { db } = await import("@/lib/server/db");
  const { allocateDepositAddress } = await import("@/lib/server/gateway");
  const { parseTerms, previewSplit } = await import("@/lib/server/chain/gateway-contract");

  // ── an invoice, approved ────────────────────────────────────────────────
  const owner = await db.user.findFirst({ where: { role: "IRANIAN" } });
  // An invoice now names the buyer it was raised for, so the fixture needs one.
  const buyer = await db.user.findFirst({ where: { role: "FOREIGN" } });
  const { nextRef } = await import("@/lib/server/refs");
  const { ref, trxRef } = await nextRef("invoice", db);
  const invoice = await db.invoice.create({
    data: {
      ref,
      trxRef,
      ownerId: owner!.id,
      counterpartyId: buyer!.id,
      amount: "1000",
      currency: "USDT",
      description: "اتصال قرارداد",
      goodsTitle: "کالای آزمون",
      senderName: "Global Imports",
      status: "APPROVED",
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  console.log("── the address comes from the contract, not from us");
  const address = await allocateDepositAddress(invoice.id, invoice.ref);
  await db.invoice.update({ where: { id: invoice.id }, data: { paymentAddress: address } });
  check("an address was quoted", /^0x[a-f0-9]{40}$/.test(address), address);

  const onChain = (await publicClient.readContract({
    address: factory as `0x${string}`,
    abi: artifacts.AfaGatewayFactory.abi,
    functionName: "depositAddressFor",
    args: [invoice.ref],
  })) as string;
  check("and it matches what the contract says", onChain.toLowerCase() === address, { onChain, address });

  const deposit = await db.depositAddress.findUnique({ where: { invoiceId: invoice.id } });
  check("the terms it commits to were stored", Boolean(deposit?.terms), deposit?.terms);

  const terms = parseTerms(deposit!.terms);
  check("with our organisation's wallet in them", terms.freezoneWallet.toLowerCase() === FREEZONE);

  const preview = previewSplit(terms, usdt("1000"));
  check("the preview matches the contract's arithmetic", preview.gateway === usdt("12") && preview.freezone === usdt("8") && preview.beneficiary === usdt("980"), {
    gateway: preview.gateway.toString(),
    freezone: preview.freezone.toString(),
    beneficiary: preview.beneficiary.toString(),
  });

  // ── the buyer pays ──────────────────────────────────────────────────────
  console.log("── a buyer pays 1000 to it");
  await publicClient.waitForTransactionReceipt({
    hash: await wallet.writeContract({
      address: token,
      abi: ERC20,
      functionName: "mint",
      args: [address as `0x${string}`, usdt("1000")],
    }),
  });

  const balanceOf = (who: string) =>
    publicClient.readContract({
      address: token,
      abi: ERC20,
      functionName: "balanceOf",
      args: [who as `0x${string}`],
    }) as Promise<bigint>;
  check("the money is at the address", (await balanceOf(address)) === usdt("1000"));

  // ── release ─────────────────────────────────────────────────────────────
  console.log("── the operator releases it — one transaction, three destinations");
  const releaseHash = await wallet.writeContract({
    address: factory as `0x${string}`,
    abi: artifacts.AfaGatewayFactory.abi,
    functionName: "release",
    args: [
      {
        invoiceRef: terms.invoiceRef,
        feeBps: terms.feeBps,
        freezoneBps: terms.freezoneBps,
        feeMin: terms.feeMin,
        feeMax: terms.feeMax,
        token: terms.token,
        gatewayWallet: terms.gatewayWallet,
        freezoneWallet: terms.freezoneWallet,
        beneficiary: terms.beneficiary,
      },
    ] as never,
  });
  await publicClient.waitForTransactionReceipt({ hash: releaseHash });

  check("the gateway was paid 12", (await balanceOf(GATEWAY)) === usdt("12"), (await balanceOf(GATEWAY)).toString());
  check("the organisation was paid 8", (await balanceOf(FREEZONE)) === usdt("8"), (await balanceOf(FREEZONE)).toString());
  check("the bank received 980", (await balanceOf(BANK)) === usdt("980"), (await balanceOf(BANK)).toString());
  check("nothing was left behind", (await balanceOf(address)) === 0n);

  // ── the server records what the contract did ────────────────────────────
  console.log("── the books are written from the contract's own event");
  const { decodeEventLog } = await import("viem");
  const receipt = await publicClient.getTransactionReceipt({ hash: releaseHash });
  let event: any = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address) continue;
    try {
      const decoded = decodeEventLog({
        abi: artifacts.AfaDeposit.abi,
        data: log.data,
        topics: log.topics,
      });
      const { eventName, args } = decoded as { eventName: string; args: unknown };
      if (eventName === "Released") event = args;
    } catch {
      /* not ours */
    }
  }
  check("the contract emitted what it paid", Boolean(event), event);
  check("the event names this invoice", event?.invoiceRef === invoice.ref, event?.invoiceRef);

  const { postDepositReleased } = await import("@/lib/server/postings");
  const { toHuman } = await import("@/lib/server/chain/client");
  await db.depositAddress.update({
    where: { id: deposit!.id },
    data: {
      sweptAt: new Date(),
      sweepTxHash: releaseHash,
      gatewayAmount: toHuman(event.gatewayAmount, "USDT"),
      freezoneAmount: toHuman(event.freezoneAmount, "USDT"),
      beneficiaryAmount: toHuman(event.beneficiaryAmount, "USDT"),
    },
  });
  await postDepositReleased({
    id: deposit!.id,
    address,
    currency: "USDT",
    total: toHuman(event.total, "USDT"),
    gateway: toHuman(event.gatewayAmount, "USDT"),
    freezone: toHuman(event.freezoneAmount, "USDT"),
    beneficiary: toHuman(event.beneficiaryAmount, "USDT"),
  });

  const entries = await db.ledgerEntry.findMany({ where: { subjectRef: address } });
  const by = (a: string) => entries.find((e) => e.account === a);
  check("the gateway's fee is recorded as received", Number(by("GATEWAY_PAID")?.amount) === 12, by("GATEWAY_PAID")?.amount?.toString());
  check("so is the organisation's share", Number(by("FREEZONE_PAID")?.amount) === 8, by("FREEZONE_PAID")?.amount?.toString());
  check("the bank's holding went up by 980", Number(by("BANK_HELD")?.amount) === 980, by("BANK_HELD")?.amount?.toString());
  check("the deposit no longer holds anything", Number(by("DEPOSIT_HELD")?.amount) === -1000, by("DEPOSIT_HELD")?.amount?.toString());
  check(
    "the entries net to zero — nothing was invented or lost",
    Number(by("DEPOSIT_HELD")?.amount) +
      Number(by("BANK_HELD")?.amount) +
      Number(by("GATEWAY_PAID")?.amount) +
      Number(by("FREEZONE_PAID")?.amount) ===
      0,
  );

  console.log("── recording the same release twice does not double the books");
  await postDepositReleased({
    id: deposit!.id,
    address,
    currency: "USDT",
    total: toHuman(event.total, "USDT"),
    gateway: toHuman(event.gatewayAmount, "USDT"),
    freezone: toHuman(event.freezoneAmount, "USDT"),
    beneficiary: toHuman(event.beneficiaryAmount, "USDT"),
  });
  const after = await db.ledgerEntry.count({ where: { subjectRef: address } });
  check("still one set of entries", after === entries.length, { now: after, was: entries.length });
}

run(main);
