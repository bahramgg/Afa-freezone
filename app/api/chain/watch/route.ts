import { runWatcher } from "@/lib/server/chain/watcher";
import { env } from "@/lib/server/env";
import { ApiError, handler, jsonOk } from "@/lib/server/http";
import { safeEqual } from "@/lib/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deposit watcher tick. Meant to be driven by a scheduler (cron job, Vercel
 * Cron, systemd timer) every 15-30 seconds. Protected by a bearer token rather
 * than a session, because no user is behind the call.
 */
export const POST = handler(async (request: Request) => {
  const expected = env().CHAIN_WATCHER_TOKEN;
  if (!expected) {
    throw new ApiError(
      503,
      "watcher_disabled",
      "CHAIN_WATCHER_TOKEN تنظیم نشده است — رصدگر غیرفعال است",
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(provided, expected)) {
    throw new ApiError(401, "unauthorized", "توکن رصدگر نامعتبر است");
  }

  return jsonOk(await runWatcher());
});
