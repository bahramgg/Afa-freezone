import { z } from "zod";
import { db } from "@/lib/server/db";
import { normalizeEmail, redeemLink, redeemOtp } from "@/lib/server/auth/otp";
import { createSession } from "@/lib/server/auth/session";
import { audit } from "@/lib/server/audit";
import { badRequest, clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two ways in, one record behind them.
 *
 * A code is typed; a link is followed. Both spend the same single-use row, so
 * whichever arrives first ends the other — a link left sitting in an inbox
 * cannot be replayed after its code has been used.
 */
const Body = z
  .object({
    email: z.string().min(4).optional(),
    code: z.string().regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد").optional(),
    token: z.string().min(20).optional(),
  })
  .refine((b) => Boolean(b.token) || Boolean(b.email && b.code), {
    message: "کد یا پیوند ورود الزامی است",
  });

/** Where each role lands once it is through the door. */
const HOME = {
  IRANIAN: "/dashboard",
  FOREIGN: "/foreign/dashboard",
  ADMIN: "/admin/dashboard",
  BANK: "/bank/dashboard",
  SUPERADMIN: "/system/users",
} as const;

export const POST = handler(async (request: Request) => {
  const body = await readJson(request, Body);

  // The link carries no address of its own — the record it opens supplies one,
  // so a token cannot be aimed at somebody else's account.
  const viaLink = Boolean(body.token);
  const email = viaLink
    ? await redeemLink(body.token!)
    : await (async () => {
        const normalized = normalizeEmail(body.email!);
        await redeemOtp(normalized, body.code!);
        return normalized;
      })();

  let user = await db.user.findUnique({ where: { email } });
  if (user?.disabledAt) throw forbidden("حساب کاربری شما غیرفعال شده است");

  const isNew = !user;
  if (!user) {
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    if (settings?.registrationRestricted) {
      const allowed = await db.allowedEmail.findUnique({ where: { email } });
      if (!allowed) throw badRequest("ثبت‌نام با این نشانی مجاز نیست");
    }
    // An address nobody has seen becomes an Iranian merchant awaiting KYC.
    // Staff and foreign accounts are made deliberately, never by signing in.
    user = await db.user.create({
      data: {
        uid: await nextUid("IRANIAN"),
        role: "IRANIAN",
        email,
        fullName: "",
        kyc: "PENDING",
      },
    });
  }

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });

  await audit(isNew ? "REGISTERED" : viaLink ? "LOGIN_VIA_LINK" : "LOGIN_SUCCEEDED", {
    request,
    actorId: user.id,
    subject: email,
    detail: user.role,
  });

  const staff = user.role === "ADMIN" || user.role === "BANK" || user.role === "SUPERADMIN";
  return jsonOk({
    user: serializeUser(user),
    isNew,
    home: HOME[user.role],
    hasProfile:
      staff || user.role === "FOREIGN" ? !!user.fullName : !!(user.fullName && user.nationalId),
    hasPassedKyc: staff ? true : user.kyc === "APPROVED",
  });
});
