import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "../db";
import { env, isProduction } from "../env";
import type { Role, User } from "@/lib/generated/prisma/client";

export const SESSION_COOKIE = "afa_session";

/**
 * Sessions are opaque random tokens. Only their SHA-256 digest is stored, so a
 * database dump cannot be replayed as a valid cookie.
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = Pick<
  User,
  "id" | "uid" | "role" | "fullName" | "email" | "phone" | "kyc" | "avatarColor" | "disabledAt"
>;

const SESSION_USER_SELECT = {
  id: true,
  uid: true,
  role: true,
  fullName: true,
  email: true,
  phone: true,
  kyc: true,
  avatarColor: true,
  disabledAt: true,
} as const;

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 3600_000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Resolves the signed-in user, or null when there is no usable session. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: { select: SESSION_USER_SELECT },
    },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.disabledAt) return null;

  return session.user;
}

export async function destroySession() {
  const token = await readSessionToken();
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Revokes every other session for a user — used after credential changes. */
export async function revokeAllSessions(userId: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function roleAllows(role: Role, allowed: readonly Role[]) {
  return allowed.includes(role);
}

/** Constant-time compare for tokens supplied in headers. */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
