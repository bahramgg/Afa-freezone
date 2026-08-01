import { z } from "zod";
import { badRequest, handler, jsonOk, readJson, requireUser } from "@/lib/server/http";
import { ChainVerificationError, verifyTransfer } from "@/lib/server/chain/verify";
import { explorerTxUrl } from "@/lib/server/chain/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  txHash: z.string().trim(),
  expectTo: z.string().trim().optional(),
  expectCurrency: z.enum(["USDT", "BNB"]).optional(),
  expectMinAmount: z.string().optional(),
});

/**
 * Read-only lookup so a form can show what a hash actually contains before the
 * user commits to submitting it. Records nothing.
 */
export const POST = handler(async (request: Request) => {
  await requireUser();
  const body = await readJson(request, Body);

  try {
    const result = await verifyTransfer(body.txHash, {
      to: body.expectTo,
      currency: body.expectCurrency,
      minAmount: body.expectMinAmount,
    });
    return jsonOk({
      transfer: { ...result, blockNumber: result.blockNumber.toString() },
      explorerUrl: explorerTxUrl(result.hash),
    });
  } catch (error) {
    if (error instanceof ChainVerificationError) throw badRequest(error.message);
    throw error;
  }
});
