import "server-only";
import { randomInt } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { smsProvider } from "../sms";
import { hashSecret, verifySecret } from "./password";
import { badRequest, tooManyRequests } from "../http";

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
 * and any earlier unconsumed code for the same number is invalidated so a user
 * can never have two live codes at once.
 */
export async function issueOtp(phone: string): Promise<{ expiresAt: Date; devCode?: string }> {
  const { OTP_TTL_MINUTES, SMS_PROVIDER, NODE_ENV } = env();

  const last = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    throw tooManyRequests(`برای ارسال مجدد کد ${wait} ثانیه صبر کنید`);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const user = await db.user.findUnique({ where: { phone }, select: { id: true } });

  await db.$transaction([
    // Supersede outstanding codes so only the newest one can be redeemed.
    db.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.otpCode.create({
      data: { phone, codeHash: await hashSecret(code), expiresAt, userId: user?.id ?? null },
    }),
  ]);

  await smsProvider().send({
    to: phone,
    text: `کد ورود شما به سامانه AFA: ${code}\nاعتبار: ${OTP_TTL_MINUTES} دقیقه`,
    tokens: [code],
  });

  // Only the console provider exposes the code back to the caller, and only
  // outside production, so the login screen is testable without an SMS panel.
  const devCode = SMS_PROVIDER === "console" && NODE_ENV !== "production" ? code : undefined;
  return { expiresAt, devCode };
}

/** Consumes a code. Returns the phone on success; throws on any failure. */
export async function redeemOtp(phone: string, code: string): Promise<void> {
  const record = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
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
