import { z } from "zod";
import { db } from "@/lib/server/db";
import { issueOtp, normalizeEmail } from "@/lib/server/auth/otp";
import { admits } from "@/lib/server/auth/access";
import { audit } from "@/lib/server/audit";
import { clientIp, forbidden, handler, jsonOk, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { env } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().min(4) });

/**
 * Sends a sign-in email — a code and a link — to any address, whatever panel it
 * belongs to.
 *
 * The reply says nothing about whether an account exists. Answering differently
 * would turn this into a way to find out who banks with the free zone, and an
 * address nobody has seen before is a registration rather than an error.
 */
export const POST = handler(async (request: Request) => {
  // Before anything else, and before the address is even read: the per-address
  // cooldown further down stops someone hammering one inbox, and this stops the
  // same caller walking a list of thousands, each of which would otherwise be a
  // first request and a real email.
  rateLimit(`otp:${clientIp(request) ?? "unknown"}`, {
    limit: env().AUTH_RATE_LIMIT * 1,
    windowMs: 10 * 60_000,
    message: "درخواست‌های ورود از این دستگاه بیش از حد مجاز است",
  });

  const { email } = await readJson(request, Body);
  const normalized = normalizeEmail(email);

  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, disabledAt: true },
  });
  // A disabled account is told plainly. There is nothing left to protect —
  // whoever holds the address already knows it exists — and leaving them to
  // wait on an email that will never work is worse than saying so.
  if (user?.disabledAt) throw forbidden("حساب کاربری شما غیرفعال شده است");

  // Asked here as well as at verify, so nobody is sent a code that cannot work.
  const verdict = await admits(normalized);
  if (!verdict.allowed) throw forbidden(verdict.reason);

  const origin = new URL(request.url).origin;
  const { expiresAt, devCode, devLink } = await issueOtp(normalized, origin);
  await audit("LOGIN_CODE_SENT", { request, actorId: user?.id, subject: normalized });

  return jsonOk({ email: normalized, expiresAt: expiresAt.toISOString(), devCode, devLink });
});
