import { z } from "zod";
import { db } from "@/lib/server/db";
import { badRequest, handler, jsonOk, notFound, readJson, requireRole } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

/** The KYC decision. Rejection always carries a reason the user can act on. */
export const POST = handler(
  async (request: Request, ctx: { params: Promise<{ uid: string }> }) => {
    const admin = await requireRole("ADMIN");
    const { uid } = await ctx.params;
    const { action, reason } = await readJson(request, Body);

    const user = await db.user.findUnique({ where: { uid } });
    if (!user) throw notFound("کاربر یافت نشد");
    if (action === "reject" && !reason) throw badRequest("دلیل رد احراز هویت الزامی است");

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        kyc: action === "approve" ? "APPROVED" : "REJECTED",
        kycRejectReason: action === "reject" ? reason : null,
        kycReviewedAt: new Date(),
        kycReviewedById: admin.id,
      },
    });

    await notify(user.id, {
      kind: action === "approve" ? "KYC_APPROVED" : "KYC_REJECTED",
      title: action === "approve" ? "احراز هویت تأیید شد" : "احراز هویت رد شد",
      body:
        action === "approve"
          ? "حساب شما تأیید شد و اکنون می‌توانید از سامانه استفاده کنید"
          : `احراز هویت شما رد شد: ${reason}`,
      href: user.role === "FOREIGN" ? "/foreign/dashboard" : "/dashboard",
    });

    return jsonOk({ user: serializeUser(updated) });
  },
);
