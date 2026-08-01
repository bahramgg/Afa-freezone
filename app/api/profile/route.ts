import { z } from "zod";
import { db } from "@/lib/server/db";
import { conflict, handler, jsonOk, readJson, requireUser } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serialize";
import { notifyRole } from "@/lib/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  fullName: z.string().trim().min(2).optional(),
  nationalId: z.string().trim().regex(/^\d{10}$/, "کد ملی باید ۱۰ رقم باشد").optional(),
  email: z.string().email("ایمیل معتبر نیست").optional(),
  address: z.string().trim().max(300).optional(),
  freezoneId: z.string().trim().max(60).optional(),
  passportNo: z.string().trim().max(40).optional(),
  country: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(20).optional(),
});

/**
 * Profile edits. Identity fields (name, national id, passport) are only
 * writable while KYC is still pending — once approved they are evidence and
 * changing them has to go through a fresh review.
 */
export const PATCH = handler(async (request: Request) => {
  const session = await requireUser();
  const input = await readJson(request, Body);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  const locked = user.kyc === "APPROVED";

  if (input.email && input.email !== user.email) {
    const taken = await db.user.findFirst({
      where: { email: input.email.toLowerCase(), NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) throw conflict("این ایمیل قبلاً ثبت شده است");
  }

  const wasIncomplete = !user.fullName || (user.role === "IRANIAN" && !user.nationalId);

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      address: input.address ?? undefined,
      email: input.email?.toLowerCase() ?? undefined,
      phone: input.phone ?? undefined,
      fullName: locked ? undefined : input.fullName,
      nationalId: locked ? undefined : input.nationalId,
      passportNo: locked ? undefined : input.passportNo,
      country: locked ? undefined : input.country,
      freezoneId: locked ? undefined : input.freezoneId,
    },
  });

  // Completing the profile for the first time is what puts a user in the
  // reviewer's queue.
  const nowComplete =
    !!updated.fullName && (updated.role !== "IRANIAN" || !!updated.nationalId);
  if (wasIncomplete && nowComplete && updated.kyc === "PENDING") {
    await notifyRole("ADMIN", {
      kind: "KYC_SUBMITTED",
      title: "درخواست احراز هویت جدید",
      body: `${updated.fullName} (${updated.uid}) اطلاعات خود را تکمیل کرد`,
      href: "/admin/kyc",
    });
  }

  return jsonOk({
    user: serializeUser(updated),
    hasProfile: nowComplete,
    hasPassedKyc: updated.kyc === "APPROVED",
  });
});
