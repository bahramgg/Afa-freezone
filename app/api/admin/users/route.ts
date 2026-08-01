import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readQuery, requireRole } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  role: z.enum(["ALL", "IRANIAN", "FOREIGN"]).default("ALL"),
  kyc: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
  search: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

/** Admin user directory, with the per-user volume the panel displays. */
export const GET = handler(async (request: Request) => {
  await requireRole("ADMIN");
  const { role, kyc, search, take } = readQuery(request, Query);

  const where: Prisma.UserWhereInput = { role: { in: ["IRANIAN", "FOREIGN"] } };
  if (role !== "ALL") where.role = role;
  if (kyc !== "ALL") where.kyc = kyc;
  if (search) {
    where.OR = [
      { uid: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { nationalId: { contains: search } },
      { passportNo: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { _count: { select: { invoices: true } } },
  });

  const volumes = await db.invoice.groupBy({
    by: ["ownerId"],
    where: { status: "PAID", ownerId: { in: users.map((u) => u.id) } },
    _sum: { amount: true },
  });
  const volumeByOwner = new Map(volumes.map((v) => [v.ownerId, Number(v._sum.amount ?? 0)]));

  return jsonOk({
    list: users.map((u) => ({
      ...serializeUser(u),
      type: u.role,
      invoiceCount: u._count.invoices,
      volume: volumeByOwner.get(u.id) ?? 0,
    })),
  });
});
