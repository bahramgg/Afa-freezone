import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readQuery, requireRole } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});

export const GET = handler(async (request: Request) => {
  await requireRole("ADMIN");
  const { status } = readQuery(request, Query);

  const list = await db.user.findMany({
    where: {
      role: { in: ["IRANIAN", "FOREIGN"] },
      ...(status === "ALL" ? {} : { kyc: status }),
      // Someone who has not filled the form yet is not a review candidate.
      fullName: { not: "" },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return jsonOk({
    list: list.map((u) => ({ ...serializeUser(u), submittedAt: u.createdAt.toISOString() })),
  });
});
