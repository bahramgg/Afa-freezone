import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  conflict,
  forbidden,
  handler,
  jsonOk,
  notFound,
  readJson,
  requireRole,
  requireUser,
} from "@/lib/server/http";
import { serializeWallet } from "@/lib/server/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  active: z.boolean().optional(),
  label: z.string().trim().max(60).optional(),
});

export const PATCH = handler(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const input = await readJson(request, PatchBody);

    const wallet = await db.wallet.findUnique({ where: { id } });
    if (!wallet) throw notFound("کیف پول یافت نشد");

    if (wallet.ownerKind === "BANK") await requireRole("BANK");
    else if (wallet.userId !== user.id) throw forbidden();

    const updated = await db.wallet.update({
      where: { id },
      data: { active: input.active, label: input.label },
    });
    return jsonOk({ wallet: serializeWallet(updated) });
  },
);

export const DELETE = handler(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const wallet = await db.wallet.findUnique({ where: { id } });
    if (!wallet) throw notFound("کیف پول یافت نشد");
    if (wallet.ownerKind === "BANK") {
      // Bank wallets are referenced by historical transactions; deactivate
      // instead of deleting so the audit trail keeps resolving.
      throw conflict("کیف پول بانک حذف نمی‌شود — آن را غیرفعال کنید");
    }
    if (wallet.userId !== user.id) throw forbidden();

    await db.wallet.delete({ where: { id } });
    return jsonOk({ removed: true });
  },
);
