import { z } from "zod";
import { db } from "@/lib/server/db";
import { verifySecret } from "@/lib/server/auth/password";
import { createSession } from "@/lib/server/auth/session";
import { ApiError, clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
  /** Restricts which roles may sign in from a given portal. */
  portal: z.enum(["foreign", "admin", "bank"]),
});

const PORTAL_ROLES = {
  foreign: ["FOREIGN"],
  admin: ["ADMIN"],
  bank: ["BANK"],
} as const;

/**
 * Password sign-in for foreign merchants and staff. The failure message is
 * deliberately identical for "no such account" and "wrong password" so the
 * endpoint cannot be used to enumerate users.
 */
export const POST = handler(async (request: Request) => {
  const { email, password, portal } = await readJson(request, Body);
  const identifier = email.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: { email: identifier, role: { in: [...PORTAL_ROLES[portal]] } },
  });

  const valid = await verifySecret(user?.passwordHash, password);
  if (!user || !valid) {
    throw new ApiError(401, "invalid_credentials", "ایمیل یا رمز عبور نادرست است");
  }
  if (user.disabledAt) throw forbidden("حساب کاربری شما غیرفعال شده است");

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });

  return jsonOk({
    user: serializeUser(user),
    hasProfile: !!user.fullName,
    hasPassedKyc: user.role === "FOREIGN" ? user.kyc === "APPROVED" : true,
  });
});
