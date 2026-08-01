import { z } from "zod";
import { badRequest, handler, jsonOk, readJson, requireUser } from "@/lib/server/http";
import { isAddress } from "@/lib/server/chain/client";
import { issueWalletChallenge } from "@/lib/server/wallets/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ address: z.string().trim() });

/** Step one of ownership proof: hand the caller a nonce to sign. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { address } = await readJson(request, Body);
  if (!isAddress(address)) throw badRequest("آدرس BSC معتبر نیست");

  const challenge = await issueWalletChallenge(user, address);

  return jsonOk({
    address: challenge.address,
    message: challenge.message,
    expiresAt: challenge.expiresAt.toISOString(),
  });
});
