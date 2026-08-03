import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readQuery, requireRole } from "@/lib/server/http";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything that happened, from both halves of the record.
 *
 * AuditLog holds the acts — signing in, disabling an account, changing who may
 * register. StatusEvent holds the movements — every step every trade took. They
 * are kept apart because they answer different questions, and merged here
 * because an investigation does not care which table an event landed in.
 */
const Query = z.object({
  source: z.enum(["ALL", "AUDIT", "FLOW"]).default("ALL"),
  action: z.string().trim().optional(),
  search: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(500).default(200),
});

export const GET = handler(async (request: Request) => {
  await requireRole("SUPERADMIN");
  const { source, action, search, take } = readQuery(request, Query);

  const auditWhere: Prisma.AuditLogWhereInput = {};
  if (action) auditWhere.action = action;
  if (search) {
    auditWhere.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { detail: { contains: search, mode: "insensitive" } },
      { actor: { uid: { contains: search, mode: "insensitive" } } },
    ];
  }

  const flowWhere: Prisma.StatusEventWhereInput = {};
  if (search) {
    flowWhere.OR = [
      { subjectId: { contains: search, mode: "insensitive" } },
      { note: { contains: search, mode: "insensitive" } },
      { toStatus: { contains: search, mode: "insensitive" } },
    ];
  }

  const [audits, events] = await Promise.all([
    source === "FLOW"
      ? []
      : db.auditLog.findMany({
          where: auditWhere,
          orderBy: { createdAt: "desc" },
          take,
          include: { actor: { select: { uid: true, fullName: true, role: true } } },
        }),
    source === "AUDIT"
      ? []
      : db.statusEvent.findMany({
          where: flowWhere,
          orderBy: { createdAt: "desc" },
          take,
          include: { actorUser: { select: { uid: true, fullName: true, role: true } } },
        }),
  ]);

  const merged = [
    ...audits.map((a) => ({
      id: a.id,
      source: "AUDIT" as const,
      action: a.action,
      subject: a.subject ?? undefined,
      detail: a.detail ?? undefined,
      actorUid: a.actor?.uid,
      actorName: a.actor?.fullName,
      actorRole: a.actor?.role,
      ip: a.ip ?? undefined,
      createdAt: a.createdAt.toISOString(),
    })),
    ...events.map((e) => ({
      id: e.id,
      source: "FLOW" as const,
      action: `${e.subject.toUpperCase()}_${e.toStatus}`,
      subject: e.subjectId,
      detail: e.note ?? (e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus),
      actorUid: e.actorUser?.uid,
      actorName: e.actorUser?.fullName,
      actorRole: e.actorUser?.role,
      ip: undefined,
      createdAt: e.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, take);

  const actions = await db.auditLog.groupBy({ by: ["action"], _count: true });

  return jsonOk({
    list: merged,
    actions: actions.map((a) => ({ action: a.action, count: a._count })),
  });
});
