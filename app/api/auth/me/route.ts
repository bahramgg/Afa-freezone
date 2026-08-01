import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/session";
import { handler, jsonOk } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single source of truth for who is signed in. Returns null rather than 401 so
 * the client can treat "signed out" as an ordinary state, not an error.
 */
export const GET = handler(async () => {
  const session = await currentUser();
  if (!session) return jsonOk({ user: null });

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return jsonOk({ user: null });

  return jsonOk({
    user: serializeUser(user),
    hasProfile:
      user.role === "IRANIAN" ? !!(user.fullName && user.nationalId) : !!user.fullName,
    hasPassedKyc: user.role === "IRANIAN" || user.role === "FOREIGN"
      ? user.kyc === "APPROVED"
      : true,
  });
});
