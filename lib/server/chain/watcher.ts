import "server-only";
import { db } from "../db";
import { env } from "../env";
import {
  irreversibleBlock,
  normalizeAddress,
  publicClient,
  toHuman,
  TRANSFER_EVENT,
  usdtAddress,
} from "./client";
import { notify } from "../notify";
import { openDepositAddresses } from "../gateway";
import { parseTerms, splitForAmount } from "./gateway-contract";
import { raisePayoutSettlement } from "../payout";
import { postInvoicePaid, postSendCompleted } from "../postings";
import type { Prisma } from "@/lib/generated/prisma/client";

export type WatcherReport = {
  fromBlock: string;
  toBlock: string;
  transfersSeen: number;
  depositsRecorded: number;
  invoicesPaid: number;
  settlementsConfirmed: number;
  confirmationsUpdated: number;
  invoicesExpired: number;
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
  const { CHAIN_ID, CHAIN_SCAN_BATCH, CHAIN_SCAN_MAX_REQUESTS } = env();
  const client = publicClient();
  const [head, finalized] = await Promise.all([client.getBlockNumber(), irreversibleBlock()]);

  const cursor = await db.chainCursor.findUnique({ where: { chainId: CHAIN_ID } });
  // A fresh install starts one batch back rather than at genesis.
  const fromBlock = cursor
    ? cursor.lastScannedBlock + 1n
    : head > BigInt(CHAIN_SCAN_BATCH)
      ? head - BigInt(CHAIN_SCAN_BATCH)
      : 0n;

  // One tick covers as much ground as its request budget allows. Providers cap
  // the range per request, and BSC produces a block roughly every half second,
  // so a single-window pass would fall permanently behind the head.
  const span = BigInt(CHAIN_SCAN_BATCH) * BigInt(CHAIN_SCAN_MAX_REQUESTS);
  const toBlock = fromBlock + span > head ? head : fromBlock + span;

  const report: WatcherReport = {
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    transfersSeen: 0,
    depositsRecorded: 0,
    invoicesPaid: 0,
    settlementsConfirmed: 0,
    confirmationsUpdated: 0,
    invoicesExpired: 0,
  };

  if (fromBlock > toBlock) {
    report.confirmationsUpdated = await refreshConfirmations(finalized);
    report.invoicesPaid += await retryUnmatchedDeposits();
    report.invoicesExpired = await expireStaleInvoices();
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
      logs = await fetchTransferLogs(fromBlock, toBlock, [...watched]);
    } catch (error) {
      report.scanSkipped = true;
      report.scanError =
        error instanceof Error ? error.message.split("\n")[0] : "log scan failed";
      report.confirmationsUpdated = await refreshConfirmations(finalized);
      report.invoicesPaid += await retryUnmatchedDeposits();
      report.invoicesExpired = await expireStaleInvoices();
      return report;
    }
    report.transfersSeen = logs.length;

    for (const log of logs) {
      const to = log.args.to ? normalizeAddress(log.args.to) : null;
      const from = log.args.from ? normalizeAddress(log.args.from) : null;
      const value = log.args.value;
      if (!to || !from || value == null || !watched.has(to)) continue;

      const confirmations = Number(head - log.blockNumber) + 1;
      const confirmed = log.blockNumber <= finalized;

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

  report.confirmationsUpdated = await refreshConfirmations(finalized);
  report.invoicesPaid += await retryUnmatchedDeposits();
  report.invoicesExpired = await expireStaleInvoices();
  return report;
}

/**
 * Tries again on confirmed deposits that never found an invoice.
 *
 * A deposit can arrive before its invoice is approved, or fall short of the
 * amount and be left waiting for the rest. Matching only ever ran at the moment
 * a transfer was first seen, so either case sat there confirmed and unmatched
 * with nobody looking at it again. This gives every one of them another pass.
 */
async function retryUnmatchedDeposits(): Promise<number> {
  const pending = await db.chainTx.findMany({
    where: { status: "CONFIRMED", matchedAt: null, direction: "IN" },
    orderBy: { seenAt: "asc" },
    take: 100,
  });

  let matched = 0;
  for (const tx of pending) {
    if (await matchInvoice(tx)) matched += 1;
  }
  return matched;
}

/**
 * Closes invoices whose window has passed without any payment.
 *
 * `expire` was an admin action nobody was ever going to remember to take, so
 * expired invoices stayed open indefinitely: their address kept being scanned,
 * and a payment arriving weeks late was still credited against a request the
 * seller had long written off. One that has received something is left alone —
 * money already arrived and a human has to decide what happens to it.
 */
async function expireStaleInvoices(): Promise<number> {
  const stale = await db.invoice.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED", "PAYMENT_PENDING"] },
      expiresAt: { lt: new Date() },
      OR: [{ receivedAmount: null }, { receivedAmount: { lte: 0 } }],
    },
    select: { id: true, ref: true, ownerId: true, status: true },
    take: 200,
  });

  for (const invoice of stale) {
    await db.$transaction([
      db.invoice.update({ where: { id: invoice.id }, data: { status: "EXPIRED" } }),
      db.statusEvent.create({
        data: {
          subject: "invoice",
          subjectId: invoice.id,
          fromStatus: invoice.status,
          toStatus: "EXPIRED",
          actor: "SYSTEM",
          note: "مهلت پرداخت بدون دریافت وجه به پایان رسید",
        },
      }),
    ]);
    await notify(invoice.ownerId, {
      kind: "INVOICE_EXPIRED",
      title: "فاکتور منقضی شد",
      body: `مهلت پرداخت فاکتور ${invoice.ref} به پایان رسید`,
      href: `/receive/${invoice.ref}`,
    });
  }
  return stale.length;
}

/**
 * Providers cap how wide an `eth_getLogs` range may be. The span is cut into
 * CHAIN_SCAN_BATCH-sized windows up front so the common case costs one request
 * per window; halving is kept only as the fallback for a provider whose real
 * cap is narrower than configured. Binary-searching from the full span instead
 * would rediscover the cap on every pass and overshoot below it.
 */
function getTransferLogs(fromBlock: bigint, toBlock: bigint, recipients: string[]) {
  return publicClient().getLogs({
    address: usdtAddress(),
    event: TRANSFER_EVENT,
    // The node filters on the indexed recipient, so a pass returns only the
    // handful of transfers aimed at gateway wallets rather than every USDT
    // movement on the chain.
    args: { to: recipients as `0x${string}`[] },
    fromBlock,
    toBlock,
  });
}

type TransferLog = Awaited<ReturnType<typeof getTransferLogs>>[number];

async function fetchTransferLogs(
  fromBlock: bigint,
  toBlock: bigint,
  recipients: string[],
): Promise<TransferLog[]> {
  const out: TransferLog[] = [];
  const window = BigInt(env().CHAIN_SCAN_BATCH);
  const queue: [bigint, bigint][] = [];
  for (let start = fromBlock; start <= toBlock; start += window) {
    const end = start + window - 1n > toBlock ? toBlock : start + window - 1n;
    queue.push([start, end]);
  }

  while (queue.length) {
    const [start, end] = queue.shift()!;
    try {
      out.push(...(await getTransferLogs(start, end, recipients)));
    } catch (error) {
      if (start >= end) throw error;
      const mid = start + (end - start) / 2n;
      queue.unshift([start, mid], [mid + 1n, end]);
    }
  }
  return out;
}

async function watchedAddresses(): Promise<Set<string>> {
  const [bankWallets, deposits] = await Promise.all([
    db.wallet.findMany({
      where: { ownerKind: "BANK", active: true, bankKind: { in: ["RECEIVE", "SHARED"] } },
      select: { address: true },
    }),
    // Every allocated deposit address until it is swept — including expired and
    // already-paid invoices, because a late or duplicate payment still has to
    // be seen rather than silently absorbed.
    openDepositAddresses(),
  ]);

  const set = new Set<string>();
  for (const w of bankWallets) set.add(w.address);
  for (const address of deposits) set.add(address);
  return set;
}

/**
 * Credits the invoice that owns this address.
 *
 * The address identifies the invoice on its own, so there is no guessing from
 * the amount and no way for one buyer's payment to settle another's invoice.
 * What arrives is added up: a buyer who pays in two goes is credited for both,
 * one who underpays leaves the invoice open at the same address so they can top
 * it up, and one who overpays is credited for what they actually sent.
 */
async function matchInvoice(tx: { id: string; toAddress: string; amount: Prisma.Decimal }) {
  const deposit = await db.depositAddress.findUnique({
    where: { address: tx.toAddress },
    include: { invoice: { include: { owner: { select: { id: true } } } } },
  });
  if (!deposit?.invoice) return false;

  const invoice = deposit.invoice;

  // Sum what this address has now seen rather than trusting one transfer.
  const received = (await db.chainTx.aggregate({
    where: { toAddress: tx.toAddress, status: "CONFIRMED", currency: invoice.currency },
    _sum: { amount: true },
  }))._sum.amount;
  const total = received ?? tx.amount;

  await db.depositAddress.update({
    where: { id: deposit.id },
    data: { receivedAmount: total },
  });

  if (invoice.status === "PAID" || invoice.status === "REJECTED") return false;

  if (total.lessThan(invoice.amount)) {
    // Short. The invoice stays open on the same address so the buyer can finish.
    await db.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAYMENT_PENDING", receivedAmount: total },
    });
    await notify(invoice.ownerId, {
      kind: "PAYMENT_PARTIAL",
      title: "پرداخت ناقص دریافت شد",
      body: `برای فاکتور ${invoice.ref} تاکنون ${total} از ${invoice.amount} دریافت شده است`,
      href: `/receive/${invoice.ref}`,
    });
    return false;
  }

  // The fee comes from the terms this address was derived from, not from the
  // settings row: the contract is what will actually take it, and a figure
  // worked out anywhere else is wrong the moment an admin edits the setting.
  const { fee, net } = splitForAmount(parseTerms(deposit.terms), total.toString());

  await db.$transaction([
    db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        chainTxId: tx.id,
        receivedAmount: total,
        feeAmount: fee,
        netAmount: net,
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

  await postInvoicePaid({
    id: invoice.id,
    ref: invoice.ref,
    ownerId: invoice.ownerId,
    currency: invoice.currency,
    receivedAmount: total,
    feeAmount: fee,
    netAmount: net,
  });

  // The money is here now; the payout carries it on to the merchant.
  await raisePayoutSettlement({ ...invoice, netAmount: net as unknown as Prisma.Decimal });

  return true;
}

/**
 * Advances confirmation counts on transactions still maturing, and promotes
 * them once they cross the threshold. Invoices, settlements and sends waiting
 * on those transactions are all moved forward in the same pass.
 */
async function refreshConfirmations(finalized: bigint): Promise<number> {
  const head = await publicClient().getBlockNumber();
  const pending = await db.chainTx.findMany({
    where: { status: "CONFIRMING", blockNumber: { not: null } },
    take: 200,
  });

  let updated = 0;
  for (const tx of pending) {
    if (tx.blockNumber == null) continue;
    const confirmations = Number(head - tx.blockNumber) + 1;
    if (confirmations === tx.confirmations) continue;

    const confirmed = tx.blockNumber <= finalized;
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
      await promoteSend(tx.id);
    }
  }
  return updated;
}

/**
 * A send whose outgoing transfer just finalised moves to PAID.
 *
 * Without this the flow dead-ends: `recordCryptoSent` parks the request at
 * CRYPTO_SENT whenever the bank submits a hash the chain has not finalised yet,
 * and nothing else in the system can advance it — the transition route only
 * accepts that action from RIAL_RECEIVED, so the request would stay short of
 * PAID forever.
 */
async function promoteSend(chainTxId: string) {
  const send = await db.sendRequest.findFirst({
    where: { chainTxId, status: "CRYPTO_SENT" },
  });
  if (!send) return;

  await db.$transaction([
    db.sendRequest.update({ where: { id: send.id }, data: { status: "PAID" } }),
    db.statusEvent.create({
      data: {
        subject: "send",
        subjectId: send.id,
        fromStatus: send.status,
        toStatus: "PAID",
        actor: "SYSTEM",
        note: "ارسال کریپتو روی زنجیره تأیید شد",
      },
    }),
  ]);

  await postSendCompleted({
    id: send.id,
    ref: send.ref,
    currency: send.currency,
    feeAmount: send.feeAmount,
    spreadRial: send.bankSpreadRial,
  });

  await notify(send.ownerId, {
    kind: "SEND_COMPLETED",
    title: "ارسال انجام شد",
    body: `تراکنش ${send.trxRef} روی شبکه تأیید شد`,
    href: "/send",
  });
  if (send.counterpartyId) {
    await notify(send.counterpartyId, {
      kind: "FOREIGN_CRYPTO_RECEIVED",
      title: "کریپتو دریافت شد",
      body: `کریپتو تراکنش ${send.trxRef} روی شبکه تأیید شد`,
      href: "/foreign/requests",
    });
  }
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
