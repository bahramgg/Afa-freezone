import { z } from "zod";
import { db } from "@/lib/server/db";
import { createSession, currentUser } from "@/lib/server/auth/session";
import { clientIp, handler, jsonOk, notFound, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { nextUid } from "@/lib/server/uid";
import { env } from "@/lib/server/env";
import type { Role } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens a panel without a sign-in.
 *
 * There are no credentials here — the link is the credential. Arriving at a
 * panel adopts the representative account for its role, and everything
 * downstream then works exactly as it always did: the session is a real
 * session, so row scoping, role checks and ownership are untouched. Nothing
 * about who may do what has been relaxed; only the question of who you are has
 * stopped being asked.
 *
 * The whole route is absent unless AUTH_OPEN_ACCESS is set, so a deployment
 * that has not opted in cannot be walked into by guessing this path.
 */
const Body = z.object({
  portal: z.enum(["user", "foreign", "admin", "bank"]),
});

const ROLE: Record<z.infer<typeof Body>["portal"], Role> = {
  user: "IRANIAN",
  foreign: "FOREIGN",
  admin: "ADMIN",
  bank: "BANK",
};

/** The account a panel adopts: a real one if the seed made it, else created. */
const DEMO: Record<Role, { email: string; fullName: string }> = {
  IRANIAN: { email: "merchant@afa.local", fullName: "بازرگان نمونه" },
  FOREIGN: { email: "foreign@afa.local", fullName: "Sample Trading Co." },
  ADMIN: { email: "admin@afa.local", fullName: "کارشناس سازمان" },
  BANK: { email: "bank@afa.local", fullName: "کارشناس بانک" },
};

async function accountFor(role: Role) {
  // Prefer whoever the seed or real use already put there, so an open-access
  // demo shows the data that exists rather than an empty parallel account.
  const existing =
    (await db.user.findFirst({ where: { email: DEMO[role].email, role } })) ??
    (await db.user.findFirst({
      where: { role, disabledAt: null, ...(role === "IRANIAN" || role === "FOREIGN" ? { kyc: "APPROVED" } : {}) },
      orderBy: { createdAt: "asc" },
    }));
  if (existing) return existing;

  return db.user.create({
    data: {
      uid: await nextUid(role),
      role,
      email: DEMO[role].email,
      fullName: DEMO[role].fullName,
      // A merchant panel is unusable behind the KYC gate, and there is nobody
      // to clear it when there is nobody signing in.
      kyc: "APPROVED",
    },
  });
}

export const POST = handler(async (request: Request) => {
  if (!env().AUTH_OPEN_ACCESS) throw notFound();

  const { portal } = await readJson(request, Body);
  const role = ROLE[portal];

  // Already holding the right identity: don't mint a session on every reload.
  const session = await currentUser();
  if (session?.role === role) {
    const user = await db.user.findUnique({ where: { id: session.id } });
    if (user) return jsonOk({ user: serializeUser(user), hasProfile: true, hasPassedKyc: true });
  }

  const user = await accountFor(role);
  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: clientIp(request),
  });

  return jsonOk({ user: serializeUser(user), hasProfile: true, hasPassedKyc: true });
});
