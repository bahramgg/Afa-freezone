import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readJson, requireUser } from "@/lib/server/http";
import { serializeNotification } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const list = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return jsonOk({
    list: list.map(serializeNotification),
    unread: list.filter((n) => !n.readAt).length,
  });
});

const Body = z.object({ id: z.string().optional(), all: z.boolean().optional() });

/** Marks one notification read, or every unread one when `all` is set. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { id, all } = await readJson(request, Body);

  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(all ? {} : { id }) },
    data: { readAt: new Date() },
  });

  return jsonOk({ ok: true });
});
