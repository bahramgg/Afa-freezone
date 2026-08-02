import "server-only";
import { db } from "./db";

export type NotificationInput = {
  kind: string;
  title: string;
  body: string;
  href?: string;
};

/** Fire-and-forget in the caller's flow; failures must not roll back the action. */
export async function notify(userId: string, input: NotificationInput) {
  try {
    await db.notification.create({ data: { userId, ...input } });
  } catch (error) {
    console.error("[notify] failed to write notification", error);
  }
}

export async function notifyRole(role: "ADMIN" | "BANK", input: NotificationInput) {
  const users = await db.user.findMany({
    where: { role, disabledAt: null },
    select: { id: true },
  });
  await Promise.all(users.map((u) => notify(u.id, input)));
}

/**
 * Where an invoice lives for the person being told about it.
 *
 * Every panel has its own route for the same invoice, so a single href cannot
 * serve both sides: an Iranian merchant reads it at /receive, a foreign buyer
 * pays it at /pay, a foreign seller watches their own at /foreign/imports, and
 * an importer owes rial at /imports. Sending everyone to the raiser's route
 * meant half the notifications in the system pointed at a panel the recipient
 * has no access to.
 */
export function invoiceHref(
  role: "IRANIAN" | "FOREIGN" | "ADMIN" | "BANK",
  direction: "EXPORT" | "IMPORT",
  ref: string,
  { isRaiser }: { isRaiser: boolean },
): string {
  if (role === "ADMIN") return "/admin/invoices";
  if (role === "BANK") return "/bank/imports";
  if (direction === "IMPORT") {
    // The seller raised it and is paid in currency; the importer owes rial.
    return isRaiser ? "/foreign/imports" : "/imports";
  }
  return isRaiser ? `/receive/${ref}` : `/pay/${ref}`;
}
