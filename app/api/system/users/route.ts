import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { badRequest, handler, jsonOk, notFound, readJson, readQuery, requireRole } from "@/lib/server/http";
import { revokeAllSessions } from "@/lib/server/auth/session";
import { serializeUser } from "@/lib/server/serialize";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every account in the system, staff included.
 *
 * The organization's own directory deliberately shows only merchants — that is
 * the population it reviews. This one shows everybody, because disabling an
 * operator is exactly the kind of thing a system administrator is for.
 */
const Query = z.object({
  role: z.enum(["ALL", "IRANIAN", "FOREIGN", "ADMIN", "BANK", "SUPERADMIN"]).default("ALL"),
  state: z.enum(["ALL", "ACTIVE", "DISABLED"]).default("ALL"),
  search: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = handler(async (request: Request) => {
  await requireRole("SUPERADMIN");
  const { role, state, search, take } = readQuery(request, Query);

  const where: Prisma.UserWhereInput = {};
  if (role !== "ALL") where.role = role;
  if (state === "ACTIVE") where.disabledAt = null;
  if (state === "DISABLED") where.disabledAt = { not: null };
  if (search) {
    where.OR = [
      { uid: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Disabled accounts first (they are why someone opened this), then staff,
  // then everyone else by recency. Prisma cannot order by an enum's meaning, so
  // the roles are fetched separately and concatenated.
  const staffWhere = { ...where, role: where.role ?? { in: ["ADMIN", "BANK", "SUPERADMIN"] as const } };
  const staff =
    where.role && !["ADMIN", "BANK", "SUPERADMIN"].includes(String(where.role))
      ? []
      : await db.user.findMany({
          where: staffWhere,
          orderBy: [{ disabledAt: "asc" }, { createdAt: "asc" }],
          include: { _count: { select: { sessions: true, invoices: true } } },
        });

  const rest = await db.user.findMany({
    where: { ...where, ...(where.role ? {} : { role: { in: ["IRANIAN", "FOREIGN"] } }) },
    orderBy: [{ disabledAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(0, take - staff.length),
    include: { _count: { select: { sessions: true, invoices: true } } },
  });

  const seen = new Set<string>();
  const users = [...staff, ...rest].filter((u) => !seen.has(u.id) && seen.add(u.id));

  return jsonOk({
    list: users.map((u) => ({
      ...serializeUser(u),
      role: u.role,
      disabled: u.disabledAt !== null,
      disabledAt: u.disabledAt?.toISOString(),
      sessionCount: u._count.sessions,
      invoiceCount: u._count.invoices,
      lastSeenAt: u.updatedAt.toISOString(),
    })),
  });
});

const Action = z.object({
  uid: z.string().min(2),
  action: z.enum(["disable", "enable", "setRole"]),
  role: z.enum(["IRANIAN", "FOREIGN", "ADMIN", "BANK", "SUPERADMIN"]).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const PATCH = handler(async (request: Request) => {
  const me = await requireRole("SUPERADMIN");
  const { uid, action, role, reason } = await readJson(request, Action);

  const target = await db.user.findUnique({ where: { uid } });
  if (!target) throw notFound("کاربر یافت نشد");
  // Locking yourself out is not a recoverable mistake from inside the panel.
  if (target.id === me.id) throw badRequest("نمی‌توانید حساب خودتان را تغییر دهید");

  if (action === "disable") {
    if (target.disabledAt) throw badRequest("این حساب از قبل غیرفعال است");
    await db.user.update({ where: { id: target.id }, data: { disabledAt: new Date() } });
    // A ban that leaves the session alive is not a ban: without this the user
    // keeps working until their cookie happens to expire.
    await revokeAllSessions(target.id);
    await audit("USER_DISABLED", { request, actorId: me.id, subject: target.uid, detail: reason ?? null });
  }

  if (action === "enable") {
    await db.user.update({ where: { id: target.id }, data: { disabledAt: null } });
    await audit("USER_ENABLED", { request, actorId: me.id, subject: target.uid });
  }

  if (action === "setRole") {
    if (!role) throw badRequest("نقش جدید مشخص نشده است");
    if (role === target.role) throw badRequest("این حساب از قبل همین نقش را دارد");
    await db.user.update({ where: { id: target.id }, data: { role } });
    // The old role's sessions carry the old permissions until they are cut.
    await revokeAllSessions(target.id);
    await audit("USER_ROLE_CHANGED", {
      request,
      actorId: me.id,
      subject: target.uid,
      detail: `${target.role} → ${role}`,
    });
  }

  const updated = await db.user.findUnique({ where: { id: target.id } });
  return jsonOk({ user: { ...serializeUser(updated!), disabled: updated!.disabledAt !== null } });
});
