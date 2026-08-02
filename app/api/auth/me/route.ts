import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/session";
import { handler, jsonOk } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { serializeUser } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single source of truth for who is signed in. Returns null rather than 401 so
 * the client can treat "signed out" as an ordinary state, not an error.
 */
export const GET = handler(async () => {
  // The client needs to know whether panels are open, so it can adopt an
  // identity on arrival instead of showing a sign-in that no longer exists.
  const openAccess = env().AUTH_OPEN_ACCESS;

  const session = await currentUser();
  if (!session) return jsonOk({ user: null, openAccess });

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return jsonOk({ user: null, openAccess });

  return jsonOk({
    openAccess,
    user: serializeUser(user),
    hasProfile:
      user.role === "IRANIAN" ? !!(user.fullName && user.nationalId) : !!user.fullName,
    hasPassedKyc: user.role === "IRANIAN" || user.role === "FOREIGN"
      ? user.kyc === "APPROVED"
      : true,
  });
});
