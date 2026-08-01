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
import { serializeSend } from "@/lib/server/serialize";
import { recordTransition } from "@/lib/server/statusEvents";
import { notify } from "@/lib/server/notify";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const SEND_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  counterparty: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.SendRequestInclude;

const Query = z.object({
  status: z.string().default("ALL"),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * Visibility follows the role: the sender sees their own requests, the foreign
 * counterparty sees requests addressed to them, and admin/bank see the queue
 * they act on.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { status, take } = readQuery(request, Query);

  const where: Prisma.SendRequestWhereInput = {};
  if (user.role === "IRANIAN") where.ownerId = user.id;
  else if (user.role === "FOREIGN") {
    where.OR = [{ counterpartyId: user.id }, { counterpartyUid: user.uid }];
  } else if (user.role === "BANK") {
    // The bank only ever sees requests admin has already cleared.
    where.status = {
      in: ["AWAITING_BANK_REVIEW", "BANK_RATE_LOCKED", "RIAL_RECEIVED", "CRYPTO_SENT", "PAID", "REJECTED"],
    };
  }
  if (status !== "ALL") {
    where.status = status as Prisma.SendRequestWhereInput["status"];
  }

  const list = await db.sendRequest.findMany({
    where,
    include: SEND_INCLUDE,
    orderBy: { createdAt: "desc" },
    take,
  });

  return jsonOk({ list: list.map(serializeSend) });
});

const CreateBody = z.object({
  counterpartyUid: z.string().trim().min(2, "شناسه طرف خارجی الزامی است"),
  amount: z.number().positive("مبلغ باید بزرگ‌تر از صفر باشد"),
  currency: z.enum(["USDT", "BNB"]),
  description: z.string().trim().max(500).optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApprovedMerchant("IRANIAN");
  const input = await readJson(request, CreateBody);

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings && input.amount < Number(settings.minTxAmount)) {
    throw badRequest(`حداقل مبلغ تراکنش ${settings.minTxAmount} ${input.currency} است`);
  }

  if (settings) {
    // Daily cap is enforced server-side; the client limit is only a hint.
    const since = new Date(Date.now() - 24 * 3600_000);
    const today = await db.sendRequest.aggregate({
      where: { ownerId: user.id, createdAt: { gte: since }, status: { not: "REJECTED" } },
      _sum: { amount: true },
    });
    const used = Number(today._sum.amount ?? 0);
    if (used + input.amount > Number(settings.dailySendLimit)) {
      throw badRequest(
        `سقف ارسال روزانه شما ${settings.dailySendLimit} است و با این درخواست از آن عبور می‌کنید`,
      );
    }
  }

  const counterparty = await db.user.findFirst({
    where: { uid: input.counterpartyUid, role: "FOREIGN" },
    select: { id: true },
  });

  const rate = settings
    ? input.currency === "BNB"
      ? Number(settings.bnbRate)
      : Number(settings.usdtRate)
    : null;

  const created = await db.$transaction(async (tx) => {
    const { ref, trxRef } = await nextRef("send", tx);
    const row = await tx.sendRequest.create({
      data: {
        ref,
        trxRef,
        ownerId: user.id,
        counterpartyId: counterparty?.id ?? null,
        counterpartyUid: input.counterpartyUid,
        amount: input.amount.toString(),
        currency: input.currency,
        description: input.description ?? null,
        status: "AWAITING_COUNTERPARTY",
        // An indicative rate only; the binding one is locked later by the bank.
        exchangeRate: rate?.toString(),
        rialAmount: rate ? (rate * input.amount).toFixed(2) : undefined,
      },
      include: SEND_INCLUDE,
    });
    await recordTransition(tx, {
      subject: "send",
      subjectId: row.id,
      fromStatus: null,
      toStatus: "AWAITING_COUNTERPARTY",
      actor: "USER",
      actorUserId: user.id,
      note: "درخواست ارسال ثبت شد",
    });
    return row;
  });

  if (counterparty) {
    await notify(counterparty.id, {
      kind: "FOREIGN_RECEIVE_REQUEST",
      title: "درخواست دریافت جدید",
      body: `درخواست دریافت ${input.amount} ${input.currency} از ${user.fullName}`,
      href: "/foreign/requests",
    });
  }

  return jsonOk({ send: serializeSend(created) }, { status: 201 });
});
