import "server-only";
import { randomInt } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { emailProvider } from "../email";
import { otpEmail } from "../email/templates";
import { hashSecret, verifySecret } from "./password";
import { ApiError, badRequest, tooManyRequests } from "../http";

/** Lowercases and trims, so the same address never yields two accounts. */
export function normalizeEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw badRequest("نشانی ایمیل معتبر نیست");
  }
  return value;
}

/** Accepts 09xxxxxxxxx, 9xxxxxxxxx, +989xxxxxxxxx and 00989xxxxxxxxx. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  const local = digits.startsWith("98") ? digits.slice(2) : digits;
  const bare = local.replace(/^0/, "");
  if (!/^9\d{9}$/.test(bare)) {
    throw badRequest("شماره موبایل معتبر نیست");
  }
  return `+98${bare}`;
}

const RESEND_COOLDOWN_MS = 60_000;

/**
 * Issues a login code. The code itself is never stored — only its Argon2 hash —
 * and any earlier unconsumed code for the same address is invalidated so a user
 * can never have two live codes at once.
 */
export async function issueOtp(email: string): Promise<{ expiresAt: Date; devCode?: string }> {
  const { OTP_TTL_MINUTES, EMAIL_PROVIDER, NODE_ENV } = env();

  const last = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    throw tooManyRequests(`برای ارسال مجدد کد ${wait} ثانیه صبر کنید`);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });

  const [, issued] = await db.$transaction([
    // Supersede outstanding codes so only the newest one can be redeemed.
    db.otpCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.otpCode.create({
      data: { email, codeHash: await hashSecret(code), expiresAt, userId: user?.id ?? null },
    }),
  ]);

  try {
    await emailProvider().send({ to: email, ...otpEmail(code, OTP_TTL_MINUTES) });
  } catch (error) {
    // A code nobody received must not sit there holding the resend cooldown and
    // telling the user to check an inbox. Retract it and say what went wrong.
    await db.otpCode.delete({ where: { id: issued.id } }).catch(() => {});
    console.error("[otp] delivery failed", error);
    throw new ApiError(
      502,
      "email_delivery_failed",
      "ارسال ایمیل انجام نشد — نشانی را بررسی کنید یا بعداً دوباره تلاش کنید",
    );
  }

  // Only the console provider hands the code back to the caller, and only
  // outside production, so the login screen is testable without a mail service.
  const devCode = EMAIL_PROVIDER === "console" && NODE_ENV !== "production" ? code : undefined;
  return { expiresAt, devCode };
}

/** Consumes a code. Throws on any failure. */
export async function redeemOtp(email: string, code: string): Promise<void> {
  const record = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw badRequest("کد تأیید یافت نشد — دوباره درخواست دهید");
  if (record.expiresAt.getTime() <= Date.now()) {
    throw badRequest("کد تأیید منقضی شده است — دوباره درخواست دهید");
  }
  if (record.attempts >= env().OTP_MAX_ATTEMPTS) {
    throw tooManyRequests("تعداد تلاش‌های ناموفق بیش از حد مجاز است — کد جدید درخواست دهید");
  }

  const valid = await verifySecret(record.codeHash, code);
  if (!valid) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw badRequest("کد تأیید نادرست است");
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}
