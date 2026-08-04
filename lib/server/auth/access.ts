import "server-only";
import { db } from "../db";
import { revokeAllSessions } from "./session";
import type { Role } from "@/lib/generated/prisma/client";

/**
 * Who is admitted, as what.
 *
 * Sign-in asks this twice — once when a code is requested and once when it is
 * spent — and the two answers have to agree, so the rule lives here rather than
 * in both routes.
 */
export const STAFF_ROLES = ["ADMIN", "BANK", "SUPERADMIN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: Role): role is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(role);

export const ROLE_LABEL: Record<Role, string> = {
  IRANIAN: "بازرگان ایرانی",
  FOREIGN: "بازرگان خارجی",
  ADMIN: "سازمان منطقه آزاد",
  BANK: "بانک عامل",
  SUPERADMIN: "مدیر سیستم",
};

export type Verdict =
  | { allowed: true; role: Role | null }
  | { allowed: false; reason: string };

/**
 * What this address may sign in as.
 *
 * Three rules, in order:
 *
 * 1. A staff entry admits its holder as that operator, always. The switch that
 *    opens or closes merchant registration has nothing to do with it.
 * 2. An account that already holds a staff role but is no longer listed is
 *    refused outright. Quietly demoting them to a merchant would be worse: it
 *    invents an account nobody asked for out of a revocation.
 * 3. Everyone else is a merchant, subject to the registration switch.
 *
 * `role: null` means "whatever this account already is" — an existing merchant
 * signing in changes nothing about them.
 */
export async function admits(email: string): Promise<Verdict> {
  const [entry, user] = await Promise.all([
    db.allowedEmail.findUnique({ where: { email } }),
    db.user.findUnique({ where: { email }, select: { role: true } }),
  ]);

  if (entry && isStaffRole(entry.role)) return { allowed: true, role: entry.role };

  if (user && isStaffRole(user.role)) {
    return {
      allowed: false,
      reason: `دسترسی این نشانی به پنل ${ROLE_LABEL[user.role]} لغو شده است`,
    };
  }

  if (user) return { allowed: true, role: null };

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.registrationRestricted && !entry) {
    return { allowed: false, reason: "ثبت‌نام با این نشانی مجاز نیست — با پشتیبانی تماس بگیرید" };
  }

  // A merchant entry may still say which side of the trade they are on.
  return { allowed: true, role: entry?.role ?? "IRANIAN" };
}

/**
 * Puts the list and the accounts back in step after the list changed.
 *
 * Changing the list has to reach whoever is already signed in — an operator
 * removed at ten o'clock who keeps approving invoices until their cookie
 * expires has not been removed. Both directions cut the sessions, because the
 * old ones carry the old permissions either way.
 */
export async function applyToAccount(email: string, role: Role | null) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) return;

  // Taken off the staff list: the account keeps existing and stops operating.
  // `admits` refuses it at the door, so the role it is left holding is only a
  // record of what it used to be.
  if (role === null || role === user.role) {
    if (role === null) await revokeAllSessions(user.id);
    return;
  }

  await db.user.update({ where: { id: user.id }, data: { role } });
  await revokeAllSessions(user.id);
}
