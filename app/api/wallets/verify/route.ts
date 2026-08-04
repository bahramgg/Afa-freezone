import { z } from "zod";
import { db } from "@/lib/server/db";
import { badRequest, handler, jsonOk, readJson, requireUser } from "@/lib/server/http";
import { isAddress } from "@/lib/server/chain/client";
import { serializeWallet } from "@/lib/server/serialize";
import { verifyWalletChallenge } from "@/lib/server/wallets/ownership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string().trim(),
  label: z.string().trim().max(60).optional(),
  signature: z.string().trim(),
});

/**
 * Step two of ownership proof: check the signature and record the wallet as
 * verified. This is the only path that may set `verified` on a user wallet —
 * creating one through POST /api/wallets always leaves it unverified.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const input = await readJson(request, Body);
  if (!isAddress(input.address)) throw badRequest("آدرس کیف پول معتبر نیست");

  const proof = await verifyWalletChallenge(user, input.address, input.signature);
  const verifiedAt = new Date();

  const existing = await db.wallet.findFirst({
    where: { address: proof.address, userId: user.id },
  });

  const wallet = existing
    ? await db.wallet.update({
        where: { id: existing.id },
        data: {
          verified: true,
          verifiedAt,
          proofSignature: proof.signature,
          label: input.label || existing.label,
        },
      })
    : await db.wallet.create({
        data: {
          address: proof.address,
          label: input.label || "والت من",
          ownerKind: "USER",
          userId: user.id,
          verified: true,
          verifiedAt,
          proofSignature: proof.signature,
        },
      });

  return jsonOk({ wallet: serializeWallet(wallet) }, { status: existing ? 200 : 201 });
});
