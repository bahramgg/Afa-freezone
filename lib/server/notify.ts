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
