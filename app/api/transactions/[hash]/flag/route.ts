import { z } from "zod";
import { db } from "@/lib/server/db";
import { badRequest, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";
import { serializeChainTx } from "@/lib/server/serialize";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  flagged: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

/**
 * Taking on a deposit that matched no invoice, or putting it back.
 *
 * The reconciliation queue is money that arrived at a watched address and
 * belongs to nothing the system knows about. Only a person can resolve one, and
 * the only useful thing to record is which person and when — so a second
 * operator opening the same queue does not start again on something already in
 * hand, and so the fact that somebody looked outlives the shift that noticed it.
 *
 * A matched deposit is not in the queue and cannot be taken on: it already has
 * an invoice, and the flow that owns it is where its state belongs.
 */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ hash: string }> }) => {
    const admin = await requireRole("ADMIN");
    const { hash } = await ctx.params;
    const { flagged, note } = await readJson(request, Body);

    const tx = await db.chainTx.findUnique({ where: { hash: hash.toLowerCase() } });
    if (!tx) throw notFound("تراکنشی با این هش یافت نشد");
    if (tx.matchedAt) {
      throw badRequest("این تراکنش به یک فاکتور تطبیق داده شده و در صف بررسی نیست");
    }

    const updated = await db.chainTx.update({
      where: { id: tx.id },
      data: flagged
        ? { flaggedAt: new Date(), flaggedById: admin.id, flagNote: note ?? null }
        : { flaggedAt: null, flaggedById: null, flagNote: null },
      include: { flaggedBy: { select: { fullName: true, uid: true } } },
    });

    await audit(flagged ? "CHAINTX_FLAGGED" : "CHAINTX_UNFLAGGED", {
      request,
      actorId: admin.id,
      subject: tx.hash,
      detail: note ?? null,
    });

    return jsonOk({ transaction: serializeChainTx(updated) });
  },
);
