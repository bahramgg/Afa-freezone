import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readQuery, requireUser } from "@/lib/server/http";
import { serializeChainTx } from "@/lib/server/serialize";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["ALL", "SEEN", "CONFIRMING", "CONFIRMED", "FAILED"]).default("ALL"),
  unmatched: z.enum(["true", "false"]).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * On-chain activity. Admins see every observed transaction — including deposits
 * no invoice claims, which is exactly the reconciliation queue. Merchants see
 * only transactions tied to their own records.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { status, unmatched, take } = readQuery(request, Query);

  const where: Prisma.ChainTxWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (unmatched === "true") where.matchedAt = null;

  if (user.role !== "ADMIN" && user.role !== "BANK") {
    where.OR = [
      { invoice: { ownerId: user.id } },
      { settlement: { ownerId: user.id } },
    ];
  }

  const list = await db.chainTx.findMany({
    where,
    orderBy: { seenAt: "desc" },
    take,
    include: {
      invoice: { select: { ref: true, trxRef: true } },
      settlement: { select: { ref: true, trxRef: true } },
    },
  });

  return jsonOk({
    list: list.map((t) => ({
      ...serializeChainTx(t),
      trxId: t.invoice?.trxRef ?? t.settlement?.trxRef,
      invoiceId: t.invoice?.ref,
    })),
  });
});
