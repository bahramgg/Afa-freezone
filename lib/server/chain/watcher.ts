import "server-only";
import { db } from "../db";
import { env } from "../env";
import { normalizeAddress, publicClient, toHuman, TRANSFER_EVENT, usdtAddress } from "./client";
import { notify } from "../notify";
import type { Prisma } from "@/lib/generated/prisma/client";

export type WatcherReport = {
  fromBlock: string;
  toBlock: string;
  transfersSeen: number;
  depositsRecorded: number;
  invoicesPaid: number;
  settlementsConfirmed: number;
  confirmationsUpdated: number;
  /** Set when log scanning was unavailable this pass; see scanError. */
  scanSkipped?: boolean;
  scanError?: string;
};

/**
 * Scans BEP-20 Transfer logs addressed to any gateway or bank receive wallet,
 * records them, and matches each against an open invoice or settlement.
 *
 * Progress is bookmarked in ChainCursor so a restart resumes rather than
 * rescanning from genesis, and each pass is bounded by CHAIN_SCAN_BATCH to stay
 * within RPC log-range limits.
 */
export async function runWatcher(): Promise<WatcherReport> {
  const { CHAIN_ID, CHAIN_SCAN_BATCH, CHAIN_MIN_CONFIRMATIONS } = env();
  const client = publicClient();
  const head = await client.getBlockNumber();

  const cursor = await db.chainCursor.findUnique({ where: { chainId: CHAIN_ID } });
  // A fresh install starts one batch back rather than at genesis.
  const fromBlock = cursor
    ? cursor.lastScannedBlock + 1n
    : head > BigInt(CHAIN_SCAN_BATCH)
      ? head - BigInt(CHAIN_SCAN_BATCH)
      : 0n;
  const toBlock = fromBlock + BigInt(CHAIN_SCAN_BATCH) > head ? head : fromBlock + BigInt(CHAIN_SCAN_BATCH);

  const report: WatcherReport = {
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    transfersSeen: 0,
    depositsRecorded: 0,
    invoicesPaid: 0,
    settlementsConfirmed: 0,
    confirmationsUpdated: 0,
  };

  if (fromBlock > toBlock) {
    report.confirmationsUpdated = await refreshConfirmations(head);
    return report;
  }

  // Addresses the gateway is willing to credit: bank receive wallets plus any
  // address currently quoted on an open invoice.
  const watched = await watchedAddresses();

  if (watched.size > 0) {
    // Automatic deposit discovery needs eth_getLogs, which most free public RPC
    // endpoints throttle or refuse. When it is unavailable the pass degrades to
    // confirmation tracking instead of failing: deposits submitted by hash
    // still progress, and the cursor is left untouched so nothing is skipped
    // once a capable endpoint is configured.
    let logs: TransferLog[];
    try {
      logs = await fetchTransferLogs(fromBlock, toBlock);
    } catch (error) {
      report.scanSkipped = true;
      report.scanError =
        error instanceof Error ? error.message.split("\n")[0] : "log scan failed";
      report.confirmationsUpdated = await refreshConfirmations(head);
      return report;
    }
    report.transfersSeen = logs.length;

    for (const log of logs) {
      const to = log.args.to ? normalizeAddress(log.args.to) : null;
      const from = log.args.from ? normalizeAddress(log.args.from) : null;
      const value = log.args.value;
      if (!to || !from || value == null || !watched.has(to)) continue;

      const confirmations = Number(head - log.blockNumber) + 1;
      const confirmed = confirmations >= CHAIN_MIN_CONFIRMATIONS;

      const tx = await db.chainTx.upsert({
        where: { hash: log.transactionHash },
        create: {
          hash: log.transactionHash,
          chainId: CHAIN_ID,
          direction: "IN",
          status: confirmed ? "CONFIRMED" : "CONFIRMING",
          fromAddress: from,
          toAddress: to,
          currency: "USDT",
          amount: toHuman(value, "USDT"),
          rawValue: value.toString(),
          blockNumber: log.blockNumber,
          confirmations,
          confirmedAt: confirmed ? new Date() : null,
        },
        update: {
          status: confirmed ? "CONFIRMED" : "CONFIRMING",
          confirmations,
          confirmedAt: confirmed ? new Date() : null,
        },
      });
      report.depositsRecorded += 1;

      if (confirmed && !tx.matchedAt) {
        if (await matchInvoice(tx)) report.invoicesPaid += 1;
      }
    }
  }

  await db.chainCursor.upsert({
    where: { chainId: CHAIN_ID },
    create: { chainId: CHAIN_ID, lastScannedBlock: toBlock },
    update: { lastScannedBlock: toBlock },
  });

  report.confirmationsUpdated = await refreshConfirmations(head);
  return report;
}

/**
 * Public RPC endpoints cap `eth_getLogs` ranges, and the cap differs per
 * provider and sometimes per request. Rather than pin a batch size that works
 * on one provider and fails on the next, a rejected range is split in half and
 * retried until it is accepted or a single block still fails — at which point
 * the error is real and worth surfacing.
 */
function getTransferLogs(fromBlock: bigint, toBlock: bigint) {
  return publicClient().getLogs({
    address: usdtAddress(),
    event: TRANSFER_EVENT,
    fromBlock,
    toBlock,
  });
}

type TransferLog = Awaited<ReturnType<typeof getTransferLogs>>[number];

async function fetchTransferLogs(fromBlock: bigint, toBlock: bigint): Promise<TransferLog[]> {
  const out: TransferLog[] = [];
  const queue: [bigint, bigint][] = [[fromBlock, toBlock]];

  while (queue.length) {
    const [start, end] = queue.shift()!;
    try {
      out.push(...(await getTransferLogs(start, end)));
    } catch (error) {
      if (start >= end) throw error;
      const mid = start + (end - start) / 2n;
      queue.unshift([start, mid], [mid + 1n, end]);
    }
  }
  return out;
}

async function watchedAddresses(): Promise<Set<string>> {
  const [bankWallets, openInvoices] = await Promise.all([
    db.wallet.findMany({
      where: { ownerKind: "BANK", active: true, bankKind: { in: ["RECEIVE", "SHARED"] } },
      select: { address: true },
    }),
    db.invoice.findMany({
      where: { status: { in: ["APPROVED", "PAYMENT_PENDING"] }, paymentAddress: { not: null } },
      select: { paymentAddress: true },
    }),
  ]);

  const set = new Set<string>();
  for (const w of bankWallets) set.add(w.address);
  for (const i of openInvoices) if (i.paymentAddress) set.add(i.paymentAddress);
  return set;
}

/**
 * Credits the oldest open invoice quoting this address whose amount the deposit
 * covers. Unmatched deposits stay in ChainTx for an admin to reconcile — money
 * is never silently discarded.
 */
async function matchInvoice(tx: { id: string; toAddress: string; amount: Prisma.Decimal }) {
  const invoice = await db.invoice.findFirst({
    where: {
      status: { in: ["APPROVED", "PAYMENT_PENDING"] },
      paymentAddress: tx.toAddress,
      currency: "USDT",
      amount: { lte: tx.amount },
      chainTxId: null,
    },
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { id: true } } },
  });
  if (!invoice) return false;

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const feePercent = Number(settings?.feeBasePercent ?? 2);
  const gross = Number(invoice.amount);
  const rawFee = (gross * feePercent) / 100;
  const fee = Math.min(
    Math.max(rawFee, Number(settings?.feeMin ?? 0)),
    Number(settings?.feeMax ?? rawFee),
  );

  await db.$transaction([
    db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        chainTxId: tx.id,
        feeAmount: fee.toFixed(8),
        netAmount: (gross - fee).toFixed(8),
      },
    }),
    db.chainTx.update({ where: { id: tx.id }, data: { matchedAt: new Date() } }),
    db.statusEvent.create({
      data: {
        subject: "invoice",
        subjectId: invoice.id,
        fromStatus: invoice.status,
        toStatus: "PAID",
        actor: "SYSTEM",
        note: "پرداخت روی زنجیره تأیید شد",
      },
    }),
  ]);

  await notify(invoice.ownerId, {
    kind: "PAYMENT_RECEIVED",
    title: "پرداخت دریافت شد",
    body: `پرداخت فاکتور ${invoice.ref} روی شبکه تأیید شد`,
    href: `/receive/${invoice.ref}`,
  });

  return true;
}

/**
 * Advances confirmation counts on transactions still maturing, and promotes
 * them once they cross the threshold. Settlements waiting on their payout are
 * moved forward in the same pass.
 */
async function refreshConfirmations(head: bigint): Promise<number> {
  const pending = await db.chainTx.findMany({
    where: { status: "CONFIRMING", blockNumber: { not: null } },
    take: 200,
  });

  let updated = 0;
  for (const tx of pending) {
    if (tx.blockNumber == null) continue;
    const confirmations = Number(head - tx.blockNumber) + 1;
    if (confirmations === tx.confirmations) continue;

    const confirmed = confirmations >= env().CHAIN_MIN_CONFIRMATIONS;
    await db.chainTx.update({
      where: { id: tx.id },
      data: {
        confirmations,
        status: confirmed ? "CONFIRMED" : "CONFIRMING",
        confirmedAt: confirmed ? new Date() : null,
      },
    });
    updated += 1;

    if (confirmed) {
      if (!tx.matchedAt) await matchInvoice(tx);
      await promoteSettlement(tx.id);
    }
  }
  return updated;
}

/** A settlement whose payout tx just finalised moves to CRYPTO_CONFIRMED. */
async function promoteSettlement(chainTxId: string) {
  const settlement = await db.settlement.findFirst({
    where: { chainTxId, status: "CRYPTO_RECEIVED" },
  });
  if (!settlement) return;

  await db.$transaction([
    db.settlement.update({
      where: { id: settlement.id },
      data: { status: "CRYPTO_CONFIRMED" },
    }),
    db.statusEvent.create({
      data: {
        subject: "settlement",
        subjectId: settlement.id,
        fromStatus: settlement.status,
        toStatus: "CRYPTO_CONFIRMED",
        actor: "SYSTEM",
        note: "دریافت کریپتو روی زنجیره تأیید شد",
      },
    }),
  ]);
}
