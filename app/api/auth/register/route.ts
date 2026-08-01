import { z } from "zod";
import { db } from "@/lib/server/db";
import { hashSecret } from "@/lib/server/auth/password";
import { createSession } from "@/lib/server/auth/session";
import { clientIp, conflict, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";
import { notifyRole } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  fullName: z.string().min(2, "نام و نام خانوادگی الزامی است"),
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
  passportNo: z.string().min(3).optional(),
  country: z.string().min(2).optional(),
  phone: z.string().optional(),
});

/** Self-registration for foreign merchants. Staff accounts are seeded, not registered. */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, Body);
  const email = input.email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw conflict("این ایمیل قبلاً ثبت شده است");

  const user = await db.user.create({
    data: {
      uid: await nextUid("FOREIGN"),
      role: "FOREIGN",
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      passportNo: input.passportNo?.trim() || null,
      country: input.country?.trim() || null,
      passwordHash: await hashSecret(input.password),
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

  return jsonOk(
    { user: serializeUser(user), hasProfile: true, hasPassedKyc: false },
    { status: 201 },
  );
});
