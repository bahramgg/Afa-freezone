import { z } from "zod";
import { db } from "@/lib/server/db";
import { handler, jsonOk, readJson, requireRole, requireUser } from "@/lib/server/http";
import { serializeSettings } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadSettings() {
  return db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** Readable by any signed-in user — rates and limits drive the forms. */
export const GET = handler(async () => {
  await requireUser();
  return jsonOk({ settings: serializeSettings(await loadSettings()) });
});

const Body = z.object({
  feeBasePercent: z.number().min(0).max(100).optional(),
  feeMin: z.number().min(0).optional(),
  feeMax: z.number().min(0).optional(),
  invoiceValidityMinutes: z.number().int().min(1).max(1440).optional(),
  invoiceMinAmount: z.number().min(0).optional(),
  invoiceMaxAmount: z.number().min(0).optional(),
  usdtRate: z.number().min(0).optional(),
  bnbRate: z.number().min(0).optional(),
  dailySendLimit: z.number().min(0).optional(),
  dailySettlementLimit: z.number().min(0).optional(),
  minTxAmount: z.number().min(0).optional(),
  rateTolerancePercent: z.number().min(0).max(100).optional(),
  freezoneSharePercent: z.number().min(0).max(100).optional(),
});

export const PATCH = handler(async (request: Request) => {
  await requireRole("ADMIN");
  const input = await readJson(request, Body);

  const data = Object.fromEntries(
    Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === "number" && !Number.isInteger(v) ? v.toString() : v]),
  );

  const updated = await db.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return jsonOk({ settings: serializeSettings(updated) });
});

/**
 * What the settlement contract is actually configured to do.
 *
 * Shown beside the settings so nobody mistakes the fee stored here for the one
 * that will be charged: this row decides what a future contract is deployed
 * with, and the contract decides what happens to money.
 */
export const POST = handler(async () => {
  await requireRole("ADMIN", "BANK");
  try {
    const { currentTerms, factoryAddress } = await import("@/lib/server/chain/gateway-contract");
    const terms = await currentTerms("INV-0000");
    return jsonOk({
      contract: {
        factory: factoryAddress(),
        feePercent: terms.feeBps / 100,
        freezoneSharePercent: terms.freezoneBps / 100,
        gatewayWallet: terms.gatewayWallet,
        freezoneWallet: terms.freezoneWallet,
        bankWallet: terms.bankWallet,
      },
    });
  } catch (error) {
    return jsonOk({
      contract: null,
      reason: error instanceof Error ? error.message : "unavailable",
    });
  }
});
