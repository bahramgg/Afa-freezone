import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
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
/** SHA-256, because a link token is high-entropy and looked up by value. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueOtp(
  email: string,
  /** Absolute origin the sign-in link should point at. Omitted, no link is sent. */
  origin?: string,
): Promise<{ expiresAt: Date; devCode?: string; devLink?: string }> {
  const { OTP_TTL_MINUTES, NODE_ENV } = env();

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
  const linkToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });

  const [, issued] = await db.$transaction([
    // Supersede outstanding codes so only the newest one can be redeemed.
    db.otpCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.otpCode.create({
      data: {
        email,
        codeHash: await hashSecret(code),
        linkTokenHash: hashToken(linkToken),
        expiresAt,
        userId: user?.id ?? null,
      },
    }),
  ]);

  const link = origin ? `${origin}/login/verify?token=${linkToken}` : undefined;

  try {
    await emailProvider().send({ to: email, ...otpEmail(code, OTP_TTL_MINUTES, link) });
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

  // Outside production the code comes back to the caller so the login screen
  // and the test suites work without waiting on a mailbox. In production this
  // is never populated, whatever the mail provider is set to.
  const dev = NODE_ENV !== "production";
  return { expiresAt, devCode: dev ? code : undefined, devLink: dev ? link : undefined };
}

/**
 * Consumes a sign-in link and says which address it belonged to.
 *
 * Spends the same record the code would, so a link and a code issued together
 * cannot both be used — and an old link stops working the moment a new code is
 * requested, because issuing supersedes everything outstanding.
 */
export async function redeemLink(token: string): Promise<string> {
  const record = await db.otpCode.findFirst({
    where: { linkTokenHash: hashToken(token), consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw badRequest("این پیوند معتبر نیست یا قبلاً استفاده شده است");
  if (record.expiresAt.getTime() <= Date.now()) {
    throw badRequest("این پیوند منقضی شده است — دوباره درخواست ورود دهید");
  }

  await db.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return record.email;
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
