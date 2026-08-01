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
import { notify, notifyRole } from "@/lib/server/notify";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";
import { feeFor } from "@/lib/server/fees";
import { toRial } from "@/lib/server/money";
import { narrow, sendScope } from "@/lib/server/scope";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const SEND_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  counterparty: { select: { uid: true, fullName: true } },
  chainTx: true,
  documents: true,
} satisfies Prisma.SendRequestInclude;

const Query = z.object({
  status: z
    .enum([
      "ALL",
      "AWAITING_COUNTERPARTY",
      "AWAITING_ADMIN",
      "AWAITING_BANK_REVIEW",
      "BANK_RATE_LOCKED",
      "RIAL_RECEIVED",
      "CRYPTO_SENT",
      "PAID",
      "REJECTED",
    ])
    .default("ALL"),
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

  const where = narrow(
    sendScope(user),
    status === "ALL" ? null : { status },
  );

  const list = await db.sendRequest.findMany({
    where,
    include: SEND_INCLUDE,
    orderBy: { createdAt: "desc" },
    take,
  });

  return jsonOk({ list: list.map(serializeSend) });
});

const TradeDoc = z.object({
  kind: z.enum(["PROFORMA", "ORDER_REGISTRATION", "CUSTOMS_DECLARATION", "CONTRACT"]),
  number: z.string().trim().min(1, "شماره سند الزامی است"),
  issuedAt: z.string().datetime().optional(),
  issuer: z.string().trim().max(120).optional(),
});

const CreateBody = z.object({
  /** Either the supplier's own wallet, or a registered counterparty's uid. */
  recipientWalletAddress: z.string().trim().optional(),
  counterpartyUid: z.string().trim().min(2, "نام یا شناسه طرف خارجی الزامی است"),
  counterpartyName: z.string().trim().max(120).optional(),
  counterpartyEmail: z.string().trim().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  amount: z.number().positive("مبلغ باید بزرگ‌تر از صفر باشد"),
  currency: z.enum(["USDT", "BNB"]),
  description: z.string().trim().max(500).optional(),
  /** At least one, because the bank cannot supply currency without paper. */
  documents: z.array(TradeDoc).min(1, "دست‌کم یک سند تجاری الزامی است"),
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

  if (input.recipientWalletAddress && !isAddress(input.recipientWalletAddress)) {
    throw badRequest("آدرس کیف پول گیرنده معتبر نیست");
  }

  // The supplier may hold an account here, but usually will not: an importer
  // has their wallet address from the proforma, and requiring a foreign
  // supplier to register in an Iranian free-zone system before they can be paid
  // is how a trade stops happening rather than how it is verified.
  const counterparty = await db.user.findFirst({
    where: { uid: input.counterpartyUid, role: "FOREIGN" },
    select: { id: true },
  });

  if (!counterparty && !input.recipientWalletAddress) {
    throw badRequest("آدرس کیف پول گیرنده را وارد کنید");
  }

  const rate = settings
    ? input.currency === "BNB"
      ? Number(settings.bnbRate)
      : Number(settings.usdtRate)
    : null;

  // The foreign counterparty must receive the full agreed amount, so the
  // gateway fee goes on top of what the merchant pays rather than out of it.
  const fee = await feeFor(input.amount, "debit");

  const created = await db.$transaction(async (tx) => {
    const { ref, trxRef } = await nextRef("send", tx);
    const row = await tx.sendRequest.create({
      data: {
        ref,
        trxRef,
        ownerId: user.id,
        counterpartyId: counterparty?.id ?? null,
        counterpartyUid: input.counterpartyUid,
        counterpartyName: input.counterpartyName ?? null,
        counterpartyEmail: input.counterpartyEmail || null,
        recipientWalletAddress: input.recipientWalletAddress
          ? normalizeAddress(input.recipientWalletAddress)
          : null,
        amount: input.amount.toString(),
        currency: input.currency,
        description: input.description ?? null,
        // Nothing is waiting on the supplier once the importer has named the
        // wallet, so the request goes straight to review.
        status: input.recipientWalletAddress ? "AWAITING_ADMIN" : "AWAITING_COUNTERPARTY",
        documents: {
          create: input.documents.map((d) => ({
            kind: d.kind,
            number: d.number,
            issuedAt: d.issuedAt ? new Date(d.issuedAt) : null,
            issuer: d.issuer ?? null,
          })),
        },
        feeAmount: fee.fee.toFixed(8),
        netAmount: fee.net.toFixed(8),
        // An indicative rate only; the binding one is locked later by the bank.
        exchangeRate: rate?.toString(),
        rialAmount: rate ? toRial(rate, fee.net) : undefined,
      },
      include: SEND_INCLUDE,
    });
    await recordTransition(tx, {
      subject: "send",
      subjectId: row.id,
      fromStatus: null,
      toStatus: row.status,
      actor: "USER",
      actorUserId: user.id,
      note: input.recipientWalletAddress
        ? "درخواست ارسال با آدرس گیرنده ثبت شد"
        : "درخواست ارسال ثبت شد",
    });
    return row;
  });

  if (counterparty && created.status === "AWAITING_COUNTERPARTY") {
    await notify(counterparty.id, {
      kind: "FOREIGN_RECEIVE_REQUEST",
      title: "درخواست دریافت جدید",
      body: `درخواست دریافت ${input.amount} ${input.currency} از ${user.fullName}`,
      href: "/foreign/requests",
    });
  }
  if (created.status === "AWAITING_ADMIN") {
    await notifyRole("ADMIN", {
      kind: "SEND_AWAITING_ADMIN",
      title: "درخواست ارسال در انتظار تأیید",
      body: `درخواست ${created.ref} آمادهٔ بررسی است`,
      href: "/admin/send",
    });
  }

  return jsonOk({ send: serializeSend(created) }, { status: 201 });
});
