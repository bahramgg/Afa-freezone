import { destroySession } from "@/lib/server/auth/session";
import { handler, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await destroySession();
  return jsonOk({ signedOut: true });
});
