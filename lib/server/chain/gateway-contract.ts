import "server-only";
import artifacts from "@/contracts/artifacts/afa-gateway.json";
import { publicClient } from "./client";
import { env } from "../env";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The settlement contract.
 *
 * A deposit address is not a wallet — it is where a small contract will be
 * deployed, and its address is the hash of the terms it will pay out under.
 * That is what makes the split trustworthy: the terms are fixed the moment the
 * address is quoted, so nobody, this system included, can change where a
 * payment goes after the buyer has made it.
 *
 * Everything here reads. The only transaction is `release`, which the bank
 * operator signs from their own wallet — nothing in this system holds a key.
 */

export const FACTORY_ABI = artifacts.AfaGatewayFactory.abi;
export const DEPOSIT_ABI = artifacts.AfaDeposit.abi;

/** The terms an address commits to, exactly as the contract orders them. */
export type Terms = {
  invoiceRef: string;
  feeBps: number;
  freezoneBps: number;
  feeMin: bigint;
  feeMax: bigint;
  token: `0x${string}`;
  gatewayWallet: `0x${string}`;
  freezoneWallet: `0x${string}`;
  bankWallet: `0x${string}`;
};

export class GatewayContractError extends Error {}

export function factoryAddress(): `0x${string}` {
  const address = env().GATEWAY_FACTORY_ADDRESS;
  if (!address) {
    throw new GatewayContractError(
      "GATEWAY_FACTORY_ADDRESS is not set — deploy with `npm run contracts:deploy` first",
    );
  }
  return address as `0x${string}`;
}

/**
 * The terms a new invoice would be quoted at, read from the contract itself.
 *
 * Deliberately not assembled from our own settings: the contract is what will
 * actually perform the split, so it is the only place worth asking. If someone
 * changes the fee on chain without telling this system, the address we quote
 * still matches the money that will move.
 */
export async function currentTerms(invoiceRef: string): Promise<Terms> {
  const raw = (await publicClient().readContract({
    address: factoryAddress(),
    abi: FACTORY_ABI,
    functionName: "currentTerms",
    args: [invoiceRef],
  })) as Terms;

  return {
    invoiceRef: raw.invoiceRef,
    feeBps: Number(raw.feeBps),
    freezoneBps: Number(raw.freezoneBps),
    feeMin: BigInt(raw.feeMin),
    feeMax: BigInt(raw.feeMax),
    token: raw.token,
    gatewayWallet: raw.gatewayWallet,
    freezoneWallet: raw.freezoneWallet,
    bankWallet: raw.bankWallet,
  };
}

/** Where a buyer should pay, under these terms. Nothing is deployed by asking. */
export async function depositAddressFor(terms: Terms): Promise<`0x${string}`> {
  const address = (await publicClient().readContract({
    address: factoryAddress(),
    abi: FACTORY_ABI,
    functionName: "depositAddress",
    args: [terms],
  })) as `0x${string}`;
  return address.toLowerCase() as `0x${string}`;
}

/**
 * Terms survive as JSON on the deposit row, because releasing needs the same
 * ones the address was derived from — years later, and after the contract's
 * current terms have moved on.
 */
export function serializeTerms(terms: Terms): Prisma.InputJsonValue {
  return {
    invoiceRef: terms.invoiceRef,
    feeBps: terms.feeBps,
    freezoneBps: terms.freezoneBps,
    feeMin: terms.feeMin.toString(),
    feeMax: terms.feeMax.toString(),
    token: terms.token,
    gatewayWallet: terms.gatewayWallet,
    freezoneWallet: terms.freezoneWallet,
    bankWallet: terms.bankWallet,
  };
}

export function parseTerms(value: unknown): Terms {
  const t = value as Record<string, string | number>;
  if (!t || typeof t.invoiceRef !== "string") {
    throw new GatewayContractError("شرایط این آدرس واریز ثبت نشده است");
  }
  return {
    invoiceRef: String(t.invoiceRef),
    feeBps: Number(t.feeBps),
    freezoneBps: Number(t.freezoneBps),
    feeMin: BigInt(t.feeMin),
    feeMax: BigInt(t.feeMax),
    token: t.token as `0x${string}`,
    gatewayWallet: t.gatewayWallet as `0x${string}`,
    freezoneWallet: t.freezoneWallet as `0x${string}`,
    bankWallet: t.bankWallet as `0x${string}`,
  };
}

/**
 * What the terms mean for a given payment, worked out the same way the contract
 * does — so the panel can show a merchant what will happen before it happens.
 */
export function previewSplit(
  terms: Terms,
  total: bigint,
): { fee: bigint; gateway: bigint; freezone: bigint; bank: bigint } {
  let fee = (total * BigInt(terms.feeBps)) / 10_000n;
  if (fee < terms.feeMin) fee = terms.feeMin;
  if (terms.feeMax > 0n && fee > terms.feeMax) fee = terms.feeMax;
  if (fee > total) fee = total;

  const freezone = (fee * BigInt(terms.freezoneBps)) / 10_000n;
  return { fee, gateway: fee - freezone, freezone, bank: total - fee };
}
