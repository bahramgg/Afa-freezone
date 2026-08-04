import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  conflict,
  handler,
  jsonOk,
  readJson,
  readQuery,
  requireRole,
  requireUser,
} from "@/lib/server/http";
import { serializeWallet } from "@/lib/server/serialize";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ scope: z.enum(["mine", "bank"]).default("mine") });

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { scope } = readQuery(request, Query);

  if (scope === "bank") {
    // Bank wallets are operational infrastructure — staff only.
    await requireRole("BANK", "ADMIN");
    const list = await db.wallet.findMany({
      where: { ownerKind: "BANK" },
      orderBy: { createdAt: "asc" },
    });
    return jsonOk({ list: list.map(serializeWallet) });
  }

  const list = await db.wallet.findMany({
    where: { ownerKind: "USER", userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return jsonOk({ list: list.map(serializeWallet) });
});

const CreateBody = z.object({
  address: z.string().trim(),
  label: z.string().trim().max(60).optional(),
  scope: z.enum(["mine", "bank"]).default("mine"),
  bankKind: z.enum(["SEND", "RECEIVE", "SHARED"]).optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const input = await readJson(request, CreateBody);

  if (!isAddress(input.address)) throw badRequest("آدرس کیف پول معتبر نیست");
  const address = normalizeAddress(input.address);

  if (input.scope === "bank") {
    await requireRole("BANK");
    const existing = await db.wallet.findFirst({ where: { address, ownerKind: "BANK" } });
    if (existing) throw conflict("این آدرس قبلاً ثبت شده است");

    const wallet = await db.wallet.create({
      data: {
        address,
        label: input.label || "کیف پول بانک",
        ownerKind: "BANK",
        bankKind: input.bankKind ?? "SHARED",
        verified: true,
        verifiedAt: new Date(),
      },
    });
    return jsonOk({ wallet: serializeWallet(wallet) }, { status: 201 });
  }

  const existing = await db.wallet.findFirst({ where: { address, userId: user.id } });
  if (existing) throw conflict("این آدرس قبلاً به حساب شما اضافه شده است");

  const wallet = await db.wallet.create({
    data: {
      address,
      label: input.label || "والت جدید",
      ownerKind: "USER",
      userId: user.id,
      // Ownership proof (signed message) is a later step; until then the
      // wallet is usable but explicitly marked unverified.
      verified: false,
    },
  });

  return jsonOk({ wallet: serializeWallet(wallet) }, { status: 201 });
});
