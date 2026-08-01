import { z } from "zod";
import { issueOtp, normalizePhone } from "@/lib/server/auth/otp";
import { handler, jsonOk, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().min(4) });

export const POST = handler(async (request: Request) => {
  const { phone } = await readJson(request, Body);
  const normalized = normalizePhone(phone);
  const { expiresAt, devCode } = await issueOtp(normalized);

  return jsonOk({ phone: normalized, expiresAt: expiresAt.toISOString(), devCode });
});
