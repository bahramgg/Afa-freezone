import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { normalizeEmail } from "@/lib/server/auth/otp";
import { conflict, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is allowed to register.
 *
 * The list exists whether or not it is being enforced, so a free zone can build
 * it up while the gateway is still open to everyone and switch over in one
 * move rather than scrambling to fill it the day it closes.
 */
export const GET = handler(async () => {
  await requireRole("SUPERADMIN");
  const [settings, list] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.allowedEmail.findMany({
      orderBy: { createdAt: "desc" },
      include: { addedBy: { select: { uid: true, fullName: true } } },
    }),
  ]);

  return jsonOk({
    restricted: settings?.registrationRestricted ?? false,
    list: list.map((e) => ({
      id: e.id,
      email: e.email,
      note: e.note ?? undefined,
      addedByUid: e.addedBy?.uid,
      addedByName: e.addedBy?.fullName,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

const Body = z.object({
  action: z.enum(["add", "remove", "setRestricted"]),
  email: z.string().optional(),
  note: z.string().trim().max(200).optional(),
  restricted: z.boolean().optional(),
});

export const POST = handler(async (request: Request) => {
  const me = await requireRole("SUPERADMIN");
  const { action, email, note, restricted } = await readJson(request, Body);

  if (action === "setRestricted") {
    const value = restricted === true;
    await db.settings.upsert({
      where: { id: 1 },
      create: { id: 1, registrationRestricted: value },
      update: { registrationRestricted: value },
    });
    await audit("REGISTRATION_POLICY_CHANGED", {
      request,
      actorId: me.id,
      detail: value ? "restricted" : "open",
    });
    return jsonOk({ restricted: value });
  }

  const normalized = normalizeEmail(email ?? "");

  if (action === "add") {
    const existing = await db.allowedEmail.findUnique({ where: { email: normalized } });
    if (existing) throw conflict("این نشانی از قبل در فهرست است");
    const created = await db.allowedEmail.create({
      data: { email: normalized, note: note ?? null, addedById: me.id },
    });
    await audit("ALLOWLIST_ADDED", { request, actorId: me.id, subject: normalized, detail: note ?? null });
    return jsonOk({ entry: { id: created.id, email: created.email } }, { status: 201 });
  }

  const existing = await db.allowedEmail.findUnique({ where: { email: normalized } });
  if (!existing) throw notFound("این نشانی در فهرست نیست");
  await db.allowedEmail.delete({ where: { id: existing.id } });
  await audit("ALLOWLIST_REMOVED", { request, actorId: me.id, subject: normalized });
  return jsonOk({ removed: normalized });
});
