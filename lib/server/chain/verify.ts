import "server-only";
import { decodeEventLog } from "viem";
import { db } from "../db";
import { env } from "../env";
import {
  ERC20_ABI,
  irreversibleBlock,
  normalizeAddress,
  publicClient,
  toHuman,
  usdtAddress,
} from "./client";
import type { Currency } from "@/lib/generated/prisma/client";

export type VerifiedTransfer = {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  currency: Currency;
  /** Decimal string in whole tokens. */
  amount: string;
  rawValue: string;
  blockNumber: bigint;
  confirmations: number;
  gasFee: string;
  confirmed: boolean;
};

export class ChainVerificationError extends Error {}

/**
 * Reads a transaction straight from the node and extracts the transfer it
 * represents. A client-supplied hash is never taken at face value: the amount,
 * the recipient and the success of the transaction all come from the chain.
 *
 * Handles both native BNB transfers and BEP-20 USDT `Transfer` logs.
 */
export async function verifyTransfer(
  hashInput: string,
  expect?: { to?: string; from?: string; currency?: Currency; minAmount?: string },
): Promise<VerifiedTransfer> {
  const hash = hashInput.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) {
    throw new ChainVerificationError("هش تراکنش معتبر نیست");
  }

  const client = publicClient();

  const [receipt, tx, head, finalized] = await Promise.all([
    client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null),
    client.getTransaction({ hash: hash as `0x${string}` }).catch(() => null),
    client.getBlockNumber(),
    irreversibleBlock(),
  ]);

  if (!receipt || !tx) {
    throw new ChainVerificationError("تراکنش روی شبکه پیدا نشد — ممکن است هنوز ثبت نشده باشد");
  }
  if (receipt.status !== "success") {
    throw new ChainVerificationError("تراکنش روی شبکه ناموفق بوده است");
  }

  const confirmations = Number(head - receipt.blockNumber) + 1;
  // Irreversibility, not depth: a finalised block cannot be reorged away.
  const confirmed = receipt.blockNumber <= finalized;
  const gasFee = toHuman(receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n), "BNB");

  const token = usdtAddress();
  let transfer: { from: `0x${string}`; to: `0x${string}`; value: bigint; currency: Currency } | null =
    null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;
    try {
      const decoded = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const { from, to, value } = decoded.args as { from: string; to: string; value: bigint };
      transfer = {
        from: normalizeAddress(from),
        to: normalizeAddress(to),
        value,
        currency: "USDT",
      };
      break;
    } catch {
      // Not a Transfer log on the token contract — keep scanning.
    }
  }

  if (!transfer && tx.value > 0n && tx.to) {
    transfer = {
      from: normalizeAddress(tx.from),
      to: normalizeAddress(tx.to),
      value: tx.value,
      currency: "BNB",
    };
  }

  if (!transfer) {
    throw new ChainVerificationError("در این تراکنش هیچ انتقال USDT یا BNB یافت نشد");
  }

  if (expect?.currency && expect.currency !== transfer.currency) {
    throw new ChainVerificationError(
      `ارز تراکنش ${transfer.currency} است، اما ${expect.currency} انتظار می‌رفت`,
    );
  }
  if (expect?.from && normalizeAddress(expect.from) !== transfer.from) {
    throw new ChainVerificationError(
      `فرستنده این تراکنش ${transfer.from} است و با آدرس انتظاری نمی‌خواند`,
    );
  }
  if (expect?.to && normalizeAddress(expect.to) !== transfer.to) {
    throw new ChainVerificationError("گیرنده این تراکنش با آدرس مورد انتظار مطابقت ندارد");
  }

  const amount = toHuman(transfer.value, transfer.currency);
  if (expect?.minAmount && Number(amount) + 1e-12 < Number(expect.minAmount)) {
    throw new ChainVerificationError(
      `مبلغ تراکنش (${amount}) کمتر از مبلغ مورد انتظار (${expect.minAmount}) است`,
    );
  }

  return {
    hash: hash as `0x${string}`,
    from: transfer.from,
    to: transfer.to,
    currency: transfer.currency,
    amount,
    rawValue: transfer.value.toString(),
    blockNumber: receipt.blockNumber,
    confirmations,
    gasFee,
    confirmed,
  };
}

/**
 * Persists a verified transfer, keyed by hash so re-verification updates the
 * existing row rather than double-counting a deposit.
 */
export async function recordChainTx(
  transfer: VerifiedTransfer,
  direction: "IN" | "OUT",
) {
  const status = transfer.confirmed ? "CONFIRMED" : "CONFIRMING";
  const data = {
    chainId: env().CHAIN_ID,
    direction,
    status,
    fromAddress: transfer.from,
    toAddress: transfer.to,
    currency: transfer.currency,
    amount: transfer.amount,
    rawValue: transfer.rawValue,
    blockNumber: transfer.blockNumber,
    confirmations: transfer.confirmations,
    gasFee: transfer.gasFee,
    confirmedAt: transfer.confirmed ? new Date() : null,
  } as const;

  return db.chainTx.upsert({
    where: { hash: transfer.hash },
    create: { hash: transfer.hash, ...data },
    update: {
      status,
      confirmations: transfer.confirmations,
      blockNumber: transfer.blockNumber,
      confirmedAt: transfer.confirmed ? new Date() : null,
    },
  });
}
