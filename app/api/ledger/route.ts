import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readQuery, requireRole } from "@/lib/server/http";
import { balances } from "@/lib/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ take: z.coerce.number().int().min(1).max(200).default(100) });

/**
 * The gateway's position, and the entries behind it.
 *
 * Staff only: this is the whole business on one screen — what is still owed to
 * merchants, what the fee has earned, and whose share of it is whose.
 */
export const GET = handler(async (request: Request) => {
  await requireRole("ADMIN", "BANK");
  const { take } = readQuery(request, Query);

  const [position, entries] = await Promise.all([
    balances(),
    db.ledgerEntry.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { uid: true, fullName: true } } },
    }),
  ]);

  return jsonOk({
    balances: position,
    entries: entries.map((e) => ({
      id: e.id,
      account: e.account,
      amount: e.amount.toFixed(8),
      unit: e.unit,
      kind: e.kind,
      subject: e.subject ?? undefined,
      subjectRef: e.subjectRef ?? undefined,
      userUid: e.user?.uid,
      userName: e.user?.fullName,
      note: e.note ?? undefined,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});
