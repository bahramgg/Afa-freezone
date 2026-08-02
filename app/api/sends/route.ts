import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  gone,
  handler,
  jsonOk,
  readQuery,
  requireApprovedMerchant,
  requireUser,
} from "@/lib/server/http";
import { serializeSend } from "@/lib/server/serialize";
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

/**
 * Retired. Imports go through an invoice raised by the foreign seller.
 *
 * This flow had the bank transfer the currency straight to the supplier's
 * wallet, which meant the gateway's fee was never actually taken: every
 * completed send wrote a GATEWAY_SHARE and a FREEZONE_SHARE claim that no
 * payment on chain could ever discharge, so the books carried a receivable that
 * grew and could never be collected. The settlement contract is what fixed
 * that, and an import invoice is how an importer reaches it.
 *
 * Reading and finishing existing requests is left alone. Retiring a payment
 * flow must not strand money halfway: the ones already in flight still need the
 * bank and the admin to close them out.
 */
export const POST = handler(async () => {
  // Still behind the same gate, so an unauthenticated caller learns nothing
  // about the flow from the refusal.
  await requireApprovedMerchant("IRANIAN");
  throw gone(
    "این مسیر بازنشسته شده است — واردات از طریق فاکتوری انجام می‌شود که فروشندهٔ خارجی صادر می‌کند. " +
      "شناسهٔ کاربری خود را به فروشنده بدهید تا فاکتور را برای شما صادر کند.",
  );
});
