import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  handler,
  jsonOk,
  readJson,
  readQuery,
  requireApprovedMerchant,
  requireUser,
} from "@/lib/server/http";
import { nextRef } from "@/lib/server/refs";
import { serializeSettlement } from "@/lib/server/serialize";
import { recordTransition } from "@/lib/server/statusEvents";
import { notifyRole } from "@/lib/server/notify";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";
import { feeFor } from "@/lib/server/fees";
import { toRial } from "@/lib/server/money";
import { narrow, settlementScope } from "@/lib/server/scope";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const SETTLEMENT_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.SettlementInclude;

const Query = z.object({
  status: z
    .enum([
      "ALL",
      "AWAITING_ADMIN",
      "AWAITING_BANK",
      "BANK_RATE_LOCKED",
      "CRYPTO_RECEIVED",
      "CRYPTO_CONFIRMED",
      "SETTLED",
      "REJECTED",
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { status, take } = readQuery(request, Query);

  const where = narrow(
    settlementScope(user),
    status === "ALL" ? null : { status },
  );

  const list = await db.settlement.findMany({
    where,
    include: SETTLEMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take,
  });

  return jsonOk({ list: list.map(serializeSettlement) });
});

const CreateBody = z.object({
  goodsTitle: z.string().trim().min(1, "عنوان کالا الزامی است"),
  description: z.string().trim().min(1, "شرح الزامی است"),
  amount: z.number().positive("مبلغ باید بزرگ‌تر از صفر باشد"),
  currency: z.enum(["USDT", "BNB"]),
  walletAddress: z.string().trim().min(1, "آدرس والت مبدأ الزامی است"),
  payoutAccount: z.string().trim().min(4, "شماره حساب مقصد الزامی است"),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApprovedMerchant("IRANIAN");
  const input = await readJson(request, CreateBody);

  if (!isAddress(input.walletAddress)) throw badRequest("آدرس والت معتبر نیست");

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings) {
    if (input.amount < Number(settings.minTxAmount)) {
      throw badRequest(`حداقل مبلغ تسویه ${settings.minTxAmount} ${input.currency} است`);
    }
    const since = new Date(Date.now() - 24 * 3600_000);
    const today = await db.settlement.aggregate({
      where: { ownerId: user.id, createdAt: { gte: since }, status: { not: "REJECTED" } },
      _sum: { amount: true },
    });
    if (Number(today._sum.amount ?? 0) + input.amount > Number(settings.dailySettlementLimit)) {
      throw badRequest(`سقف تسویه روزانه شما ${settings.dailySettlementLimit} است`);
    }
  }

  const rate = settings
    ? input.currency === "BNB"
      ? Number(settings.bnbRate)
      : Number(settings.usdtRate)
    : null;

  // The merchant is handing crypto over, so the gateway fee comes off what they
  // are credited. Charged here, at the point they can still see it and decline.
  const fee = await feeFor(input.amount, "credit");

  const created = await db.$transaction(async (tx) => {
    const { ref, trxRef } = await nextRef("settlement", tx);
    const row = await tx.settlement.create({
      data: {
        ref,
        trxRef,
        ownerId: user.id,
        goodsTitle: input.goodsTitle,
        description: input.description,
        amount: input.amount.toString(),
        currency: input.currency,
        walletAddress: normalizeAddress(input.walletAddress),
        payoutAccount: input.payoutAccount,
        status: "AWAITING_ADMIN",
        feeAmount: fee.fee.toFixed(8),
        netAmount: fee.net.toFixed(8),
        exchangeRate: rate?.toString(),
        // The merchant is credited for what is left after the fee.
        rialAmount: rate ? toRial(rate, fee.net) : undefined,
      },
      include: SETTLEMENT_INCLUDE,
    });
    await recordTransition(tx, {
      subject: "settlement",
      subjectId: row.id,
      fromStatus: null,
      toStatus: "AWAITING_ADMIN",
      actor: "USER",
      actorUserId: user.id,
      note: "درخواست تسویه ثبت شد",
    });
    return row;
  });

  await notifyRole("ADMIN", {
    kind: "SETTLEMENT_SUBMITTED",
    title: "درخواست تسویه جدید",
    body: `درخواست ${created.ref} از ${user.fullName} ثبت شد`,
    href: "/admin/settlements",
  });

  return jsonOk({ settlement: serializeSettlement(created) }, { status: 201 });
});
