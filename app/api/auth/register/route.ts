import { z } from "zod";
import { db } from "@/lib/server/db";
import { createSession } from "@/lib/server/auth/session";
import { clientIp, conflict, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";
import { notifyRole } from "@/lib/server/notify";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  fullName: z.string().min(2, "نام و نام خانوادگی الزامی است"),
  email: z.string().email("ایمیل معتبر نیست"),
  passportNo: z.string().min(3).optional(),
  country: z.string().min(2).optional(),
  phone: z.string().optional(),
});

/**
 * Self-registration for foreign merchants.
 *
 * No password is taken, because none would ever be used: every panel signs in
 * by email. What this collects is the profile the free zone reviews — a name, a
 * passport, a country — and the session it opens is the same one the login door
 * would have opened a moment later.
 *
 * Staff accounts are seeded, never registered.
 */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, Body);
  const email = input.email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw conflict("این ایمیل قبلاً ثبت شده است");

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.registrationRestricted) {
    const allowed = await db.allowedEmail.findUnique({ where: { email } });
    if (!allowed) throw conflict("ثبت‌نام با این نشانی مجاز نیست — با پشتیبانی تماس بگیرید");
  }

  const user = await db.user.create({
    data: {
      uid: await nextUid("FOREIGN"),
      role: "FOREIGN",
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      passportNo: input.passportNo?.trim() || null,
      country: input.country?.trim() || null,
      kyc: "PENDING",
      avatarColor: "oklch(0.7 0.14 200)",
    },
  });

  await notifyRole("ADMIN", {
    kind: "KYC_SUBMITTED",
    title: "درخواست احراز هویت جدید",
    body: `${user.fullName} (${user.uid}) ثبت‌نام کرد و در انتظار بررسی است`,
    href: "/admin/kyc",
  });

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });
  await audit("REGISTERED", { request, actorId: user.id, subject: email, detail: "FOREIGN" });

  return jsonOk(
    { user: serializeUser(user), hasProfile: true, hasPassedKyc: false },
    { status: 201 },
  );
});
