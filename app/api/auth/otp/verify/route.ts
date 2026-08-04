import { z } from "zod";
import { db } from "@/lib/server/db";
import { normalizeEmail, redeemLink, redeemOtp } from "@/lib/server/auth/otp";
import { createSession, revokeAllSessions } from "@/lib/server/auth/session";
import { admits, isStaffRole } from "@/lib/server/auth/access";
import { audit } from "@/lib/server/audit";
import { clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { env } from "@/lib/server/env";
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
  // The per-code attempt counter resets every time a new code is asked for, so
  // on its own it does not bound guessing across codes. This does.
  rateLimit(`verify:${clientIp(request) ?? "unknown"}`, {
    limit: env().AUTH_RATE_LIMIT * 2,
    windowMs: 10 * 60_000,
    message: "تلاش‌های ورود از این دستگاه بیش از حد مجاز است",
  });

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

  // The same question the request route asked. Asking it again matters: the
  // list can change between the code being sent and the code being typed, and
  // the moment that counts is the one that hands out a session.
  const verdict = await admits(email);
  if (!verdict.allowed) throw forbidden(verdict.reason);

  const isNew = !user;
  if (!user) {
    // An address nobody has seen becomes whatever the list admits it as —
    // a merchant awaiting KYC unless an operator was expected here.
    const role = verdict.role ?? "IRANIAN";
    user = await db.user.create({
      data: {
        uid: await nextUid(role),
        role,
        email,
        fullName: "",
        kyc: isStaffRole(role) ? "APPROVED" : "PENDING",
      },
    });
  } else if (verdict.role && verdict.role !== user.role) {
    // The list is the authority on who operates what. An address moved from
    // the bank to the organization takes its account with it.
    user = await db.user.update({ where: { id: user.id }, data: { role: verdict.role } });
    await revokeAllSessions(user.id);
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
