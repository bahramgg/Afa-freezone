import { z } from "zod";
import { db } from "@/lib/server/db";
import { normalizePhone, redeemOtp } from "@/lib/server/auth/otp";
import { createSession } from "@/lib/server/auth/session";
import { clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().min(4),
  code: z.string().regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد"),
});

/**
 * Verifying an OTP both signs in an existing Iranian merchant and registers a
 * new one. A first-time number gets an account in PENDING KYC; the profile and
 * KYC screens take it from there.
 */
export const POST = handler(async (request: Request) => {
  const { phone, code } = await readJson(request, Body);
  const normalized = normalizePhone(phone);

  await redeemOtp(normalized, code);

  let user = await db.user.findUnique({ where: { phone: normalized } });

  if (user && user.role !== "IRANIAN") {
    // Staff accounts must not be reachable through the merchant OTP flow.
    throw forbidden("این شماره متعلق به یک حساب کاربری دیگر است");
  }
  if (user?.disabledAt) throw forbidden("حساب کاربری شما غیرفعال شده است");

  const isNew = !user;
  if (!user) {
    user = await db.user.create({
      data: {
        uid: await nextUid("IRANIAN"),
        role: "IRANIAN",
        phone: normalized,
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
    // The UI routes on these instead of re-deriving them client-side.
    hasProfile: !!(user.fullName && user.nationalId),
    hasPassedKyc: user.kyc === "APPROVED",
  });
});
