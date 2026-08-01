import { z } from "zod";
import { db } from "@/lib/server/db";
import { normalizeEmail, redeemOtp } from "@/lib/server/auth/otp";
import { createSession } from "@/lib/server/auth/session";
import { clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().min(4),
  code: z.string().regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد"),
});

/**
 * Verifying a code both signs in an existing Iranian merchant and registers a
 * new one. A first-time address gets an account in PENDING KYC; the profile and
 * KYC screens take it from there.
 */
export const POST = handler(async (request: Request) => {
  const { email, code } = await readJson(request, Body);
  const normalized = normalizeEmail(email);

  await redeemOtp(normalized, code);

  let user = await db.user.findUnique({ where: { email: normalized } });

  if (user && user.role !== "IRANIAN") {
    // Staff and foreign accounts have their own sign-in; this route must not
    // become a way around their password.
    throw forbidden("این نشانی متعلق به یک حساب کاربری دیگر است");
  }
  if (user?.disabledAt) throw forbidden("حساب کاربری شما غیرفعال شده است");

  const isNew = !user;
  if (!user) {
    user = await db.user.create({
      data: {
        uid: await nextUid("IRANIAN"),
        role: "IRANIAN",
        email: normalized,
        fullName: "",
        kyc: "PENDING",
      },
    });
  }

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });

  return jsonOk({
    user: serializeUser(user),
    isNew,
    hasProfile: !!(user.fullName && user.nationalId),
    hasPassedKyc: user.kyc === "APPROVED",
  });
});
