import { z } from "zod";
import { issueOtp, normalizeEmail } from "@/lib/server/auth/otp";
import { handler, jsonOk, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().min(4) });

export const POST = handler(async (request: Request) => {
  const { email } = await readJson(request, Body);
  const normalized = normalizeEmail(email);
  const { expiresAt, devCode } = await issueOtp(normalized);

  return jsonOk({ email: normalized, expiresAt: expiresAt.toISOString(), devCode });
});
