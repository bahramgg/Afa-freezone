import { z } from "zod";
import { decodeEventLog } from "viem";
import { db } from "@/lib/server/db";
import { badRequest, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";
import { publicClient, toHuman } from "@/lib/server/chain/client";
import { env } from "@/lib/server/env";
import {
  DEPOSIT_ABI,
  factoryAddress,
  FACTORY_ABI,
  parseTerms,
  previewSplit,
} from "@/lib/server/chain/gateway-contract";
import { postDepositReleased } from "@/lib/server/postings";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The deposit addresses and what is sitting in them.
 *
 * Each belongs to one invoice. Releasing one pays the gateway, the free zone
 * organization and the bank in a single transaction, in the proportions that
 * address was derived from — so this screen shows what will happen before it
 * happens, and what did happen afterwards.
 */
export const GET = handler(async () => {
  await requireRole("BANK", "ADMIN");

  const rows = await db.depositAddress.findMany({
    where: { invoiceId: { not: null } },
    include: {
      invoice: {
        select: {
          ref: true, currency: true, status: true, direction: true,
          amount: true, feeAmount: true,
        },
      },
    },
    orderBy: [{ sweptAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  // The token's own decimals, not eighteen. `toHuman` divides by this figure,
  // so a mismatch does not fail — it shows the bank a preview that is off by a
  // factor of ten to the twelfth and looks like a contract about to pay out a
  // fortune.
  const decimals = env().USDT_DECIMALS;
  return jsonOk({
    factory: (() => {
      try {
        return factoryAddress();
      } catch {
        return undefined;
      }
    })(),
    list: rows.map((d) => {
      const received = new Prisma.Decimal(d.receivedAmount);
      let preview: { gateway: string; freezone: string; beneficiary: string } | undefined;
      try {
        if (d.terms && received.gt(0)) {
          const split = previewSplit(
            parseTerms(d.terms),
            BigInt(received.mul(new Prisma.Decimal(10).pow(decimals)).toFixed(0)),
          );
          preview = {
            gateway: toHuman(split.gateway, "USDT"),
            freezone: toHuman(split.freezone, "USDT"),
            beneficiary: toHuman(split.beneficiary, "USDT"),
          };
        }
      } catch {
        // Terms that cannot be read are shown without a preview rather than
        // failing the whole screen.
      }

      return {
        id: d.id,
        index: d.index,
        address: d.address,
        invoiceRef: d.invoice?.ref,
        direction: d.invoice?.direction,
        /**
         * What should have arrived, so the operator can see a mismatch before
         * releasing rather than after.
         *
         * Releasing is irreversible and pays out whatever is sitting there: an
         * export sends the surplus to the bank's own treasury, but an import
         * sends it to the foreign seller, out of the country and out of reach.
         */
        expectedAmount: d.invoice
          ? Number(
              d.invoice.direction === "IMPORT"
                ? d.invoice.amount.add(d.invoice.feeAmount ?? 0)
                : d.invoice.amount,
            )
          : undefined,
        currency: d.invoice?.currency ?? "USDT",
        receivedAmount: Number(d.receivedAmount),
        released: d.sweptAt !== null,
        releasedAt: d.sweptAt?.toISOString(),
        txHash: d.sweepTxHash ?? undefined,
        terms: d.terms ?? undefined,
        preview,
        split: d.gatewayAmount
          ? {
              gateway: Number(d.gatewayAmount),
              freezone: Number(d.freezoneAmount ?? 0),
              beneficiary: Number(d.beneficiaryAmount ?? 0),
            }
          : undefined,
        createdAt: d.createdAt.toISOString(),
      };
    }),
  });
});

const ReleaseBody = z.object({
  id: z.string().min(1),
  txHash: z.string().trim(),
});

/**
 * Records a release that has already happened on chain.
 *
 * The transaction is sent by the operator's own wallet — nothing here holds a
 * key, and nothing here could redirect the money if it did, because the
 * destinations are fixed by the deposit address itself. What this endpoint does
 * is read the contract's own `Released` event back off the chain, so the books
 * record what the contract actually paid rather than what we expected it to.
 */
export const POST = handler(async (request: Request) => {
  await requireRole("BANK");
  const { id, txHash } = await readJson(request, ReleaseBody);

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw badRequest("هش تراکنش معتبر نیست");

  const deposit = await db.depositAddress.findUnique({
    where: { id },
    include: { invoice: { select: { ref: true, currency: true, direction: true } } },
  });
  if (!deposit) throw notFound("آدرس واریز یافت نشد");
  if (deposit.sweptAt) throw badRequest("این آدرس قبلاً تسویه شده است");

  const receipt = await publicClient()
    .getTransactionReceipt({ hash: txHash as `0x${string}` })
    .catch(() => null);
  if (!receipt) throw badRequest("تراکنش روی شبکه پیدا نشد — ممکن است هنوز ثبت نشده باشد");
  if (receipt.status !== "success") throw badRequest("تراکنش روی شبکه ناموفق بوده است");

  // The event has to come from this deposit's own address, so a hash belonging
  // to some other release cannot be used to close this one.
  let released:
    | { total: bigint; gateway: bigint; freezone: bigint; beneficiary: bigint }
    | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== deposit.address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: DEPOSIT_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== "Released") continue;
      const args = decoded.args as unknown as {
        total: bigint;
        gatewayAmount: bigint;
        freezoneAmount: bigint;
        beneficiaryAmount: bigint;
      };
      released = {
        total: args.total,
        gateway: args.gatewayAmount,
        freezone: args.freezoneAmount,
        beneficiary: args.beneficiaryAmount,
      };
      break;
    } catch {
      // Not the event we are after.
    }
  }

  if (!released) {
    throw badRequest("این تراکنش تسویه‌ای برای این آدرس ثبت نکرده است");
  }

  const currency = deposit.invoice?.currency ?? "USDT";
  const updated = await db.depositAddress.update({
    where: { id },
    data: {
      sweptAt: new Date(),
      sweepTxHash: txHash.toLowerCase(),
      gatewayAmount: toHuman(released.gateway, currency),
      freezoneAmount: toHuman(released.freezone, currency),
      beneficiaryAmount: toHuman(released.beneficiary, currency),
    },
  });

  await postDepositReleased({
    id: updated.id,
    address: updated.address,
    currency,
    direction: deposit.invoice?.direction,
    total: toHuman(released.total, currency),
    gateway: toHuman(released.gateway, currency),
    freezone: toHuman(released.freezone, currency),
    beneficiary: toHuman(released.beneficiary, currency),
  });

  return jsonOk({
    released: true,
    address: updated.address,
    split: {
      gateway: toHuman(released.gateway, currency),
      freezone: toHuman(released.freezone, currency),
      beneficiary: toHuman(released.beneficiary, currency),
    },
  });
});

export { FACTORY_ABI };
