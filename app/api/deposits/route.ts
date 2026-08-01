import { z } from "zod";
import { db } from "@/lib/server/db";
import { badRequest, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";
import { ChainVerificationError, recordChainTx, verifyTransfer } from "@/lib/server/chain/verify";
import { postDepositSwept } from "@/lib/server/postings";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The deposit addresses and what is sitting in them.
 *
 * Buyers pay into an address derived for their invoice alone, so the money
 * arrives spread across as many addresses as there were payments. This is the
 * operator's view of that: what is here, and what has already been moved into
 * the bank's treasury.
 */
export const GET = handler(async () => {
  await requireRole("BANK", "ADMIN");

  const rows = await db.depositAddress.findMany({
    where: { invoiceId: { not: null } },
    include: { invoice: { select: { ref: true, currency: true, status: true } } },
    orderBy: [{ sweptAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return jsonOk({
    list: rows.map((d) => ({
      id: d.id,
      index: d.index,
      address: d.address,
      invoiceRef: d.invoice?.ref,
      currency: d.invoice?.currency ?? "USDT",
      receivedAmount: Number(d.receivedAmount),
      swept: d.sweptAt !== null,
      sweptAt: d.sweptAt?.toISOString(),
      sweepTxHash: d.sweepTxHash ?? undefined,
      createdAt: d.createdAt.toISOString(),
    })),
  });
});

const SweepBody = z.object({
  id: z.string().min(1),
  txHash: z.string().trim(),
});

/**
 * Records that the operator swept a deposit address into the treasury.
 *
 * The gateway holds no key to these addresses, so the move happens in the
 * operator's own wallet and what makes it real here is the chain agreeing: the
 * transfer must have come from this address and landed in a bank wallet.
 */
export const POST = handler(async (request: Request) => {
  await requireRole("BANK");
  const { id, txHash } = await readJson(request, SweepBody);

  const deposit = await db.depositAddress.findUnique({
    where: { id },
    include: { invoice: { select: { ref: true, currency: true } } },
  });
  if (!deposit) throw notFound("آدرس واریز یافت نشد");
  if (deposit.sweptAt) throw badRequest("این آدرس قبلاً برداشت شده است");
  if (new Prisma.Decimal(deposit.receivedAmount).lte(0)) {
    throw badRequest("موجودی این آدرس صفر است");
  }

  const treasury = await db.wallet.findMany({
    where: { ownerKind: "BANK", active: true },
    select: { address: true },
  });
  if (treasury.length === 0) throw badRequest("کیف پول خزانه بانک تعریف نشده است");

  let verified;
  try {
    verified = await verifyTransfer(txHash, {
      from: deposit.address,
      currency: deposit.invoice?.currency ?? "USDT",
      minAmount: deposit.receivedAmount.toString(),
    });
  } catch (error) {
    if (error instanceof ChainVerificationError) throw badRequest(error.message);
    throw error;
  }

  if (!treasury.some((w) => w.address === verified.to)) {
    throw badRequest("مقصد این تراکنش هیچ‌کدام از کیف پول‌های بانک نیست");
  }

  await recordChainTx(verified, "OUT");

  const updated = await db.depositAddress.update({
    where: { id },
    data: { sweptAt: new Date(), sweepTxHash: verified.hash },
  });

  await postDepositSwept({
    id: updated.id,
    address: updated.address,
    currency: deposit.invoice?.currency ?? "USDT",
    amount: updated.receivedAmount,
  });

  return jsonOk({ swept: true, address: updated.address, txHash: verified.hash });
});
