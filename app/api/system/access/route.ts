import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { normalizeEmail } from "@/lib/server/auth/otp";
import { applyToAccount, isStaffRole, ROLE_LABEL } from "@/lib/server/auth/access";
import { badRequest, conflict, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is allowed in, and as what.
 *
 * Two populations, one list. Merchant entries only matter while registration is
 * restricted — the list can be built up with the gateway still open to everyone
 * and switched over in one move rather than filled in a scramble on the day.
 *
 * Operator entries are different: they are the only way anyone becomes the bank
 * or the organization, they apply whatever the switch says, and removing one
 * takes the panel away from whoever held it.
 */
export const GET = handler(async () => {
  await requireRole("SUPERADMIN");
  const [settings, list] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.allowedEmail.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      include: { addedBy: { select: { uid: true, fullName: true } } },
    }),
  ]);

  // What each listed address currently holds, so the panel can show an entry
  // that has been added but never used — nobody has signed in with it yet.
  const accounts = await db.user.findMany({
    where: { email: { in: list.map((e) => e.email) } },
    select: { email: true, uid: true, role: true, disabledAt: true },
  });
  const byEmail = new Map(accounts.map((a) => [a.email!, a]));

  return jsonOk({
    restricted: settings?.registrationRestricted ?? false,
    list: list.map((e) => {
      const account = byEmail.get(e.email);
      return {
        id: e.id,
        email: e.email,
        role: e.role,
        roleLabel: ROLE_LABEL[e.role],
        staff: isStaffRole(e.role),
        note: e.note ?? undefined,
        addedByUid: e.addedBy?.uid,
        addedByName: e.addedBy?.fullName,
        createdAt: e.createdAt.toISOString(),
        accountUid: account?.uid,
        accountRole: account?.role,
        accountDisabled: account ? account.disabledAt !== null : undefined,
      };
    }),
  });
});

const ROLES = ["IRANIAN", "FOREIGN", "ADMIN", "BANK", "SUPERADMIN"] as const;

const Body = z.object({
  action: z.enum(["add", "remove", "setRole", "setRestricted"]),
  email: z.string().optional(),
  role: z.enum(ROLES).optional(),
  note: z.string().trim().max(200).optional(),
  restricted: z.boolean().optional(),
});

export const POST = handler(async (request: Request) => {
  const me = await requireRole("SUPERADMIN");
  const { action, email, role, note, restricted } = await readJson(request, Body);

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
  if (!normalized.includes("@")) throw badRequest("نشانی ایمیل معتبر نیست");

  // Removing or demoting your own address is a locked door with the key inside.
  // Every other mistake on this page is undoable from this page; that one is not.
  if (action !== "add" && normalized === me.email) {
    throw badRequest("نمی‌توانید دسترسی حساب خودتان را تغییر دهید");
  }

  if (action === "add") {
    const existing = await db.allowedEmail.findUnique({ where: { email: normalized } });
    if (existing) throw conflict("این نشانی از قبل در فهرست است");

    const admitted = role ?? "IRANIAN";
    const created = await db.allowedEmail.create({
      data: { email: normalized, role: admitted, note: note ?? null, addedById: me.id },
    });
    // An address that already has an account takes the new role immediately,
    // rather than waiting for whenever they next happen to sign in.
    if (isStaffRole(admitted)) await applyToAccount(normalized, admitted);

    await audit("ALLOWLIST_ADDED", {
      request,
      actorId: me.id,
      subject: normalized,
      detail: `${admitted}${note ? ` — ${note}` : ""}`,
    });
    return jsonOk({ entry: { id: created.id, email: created.email, role: created.role } }, { status: 201 });
  }

  const existing = await db.allowedEmail.findUnique({ where: { email: normalized } });
  if (!existing) throw notFound("این نشانی در فهرست نیست");

  if (action === "setRole") {
    if (!role) throw badRequest("نقش جدید مشخص نشده است");
    if (role === existing.role) throw badRequest("این نشانی از قبل همین نقش را دارد");
    await db.allowedEmail.update({ where: { id: existing.id }, data: { role } });
    await applyToAccount(normalized, role);
    await audit("ALLOWLIST_ROLE_CHANGED", {
      request,
      actorId: me.id,
      subject: normalized,
      detail: `${existing.role} → ${role}`,
    });
    return jsonOk({ entry: { id: existing.id, email: normalized, role } });
  }

  await db.allowedEmail.delete({ where: { id: existing.id } });
  // Cuts the sessions. An operator removed at ten who keeps approving invoices
  // until their cookie expires has not been removed.
  await applyToAccount(normalized, null);
  await audit("ALLOWLIST_REMOVED", {
    request,
    actorId: me.id,
    subject: normalized,
    detail: existing.role,
  });
  return jsonOk({ removed: normalized });
});
