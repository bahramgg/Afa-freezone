import "server-only";
import { db } from "./db";
import { conflict } from "./http";
import type { Actor, Prisma } from "@/lib/generated/prisma/client";

export type Subject = "invoice" | "send" | "settlement";

export function recordTransition(
  client: Prisma.TransactionClient,
  input: {
    subject: Subject;
    subjectId: string;
    fromStatus: string | null;
    toStatus: string;
    actor: Actor;
    actorUserId?: string | null;
    note?: string | null;
  },
) {
  return client.statusEvent.create({
    data: {
      subject: input.subject,
      subjectId: input.subjectId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actor: input.actor,
      actorUserId: input.actorUserId ?? null,
      note: input.note ?? null,
    },
  });
}

export function history(subject: Subject, subjectId: string) {
  return db.statusEvent.findMany({
    where: { subject, subjectId },
    orderBy: { createdAt: "asc" },
    include: { actorUser: { select: { uid: true, fullName: true, role: true } } },
  });
}

/**
 * Guards a state machine edge. Transitions are validated server-side against
 * the record's *current* status, so a stale client cannot replay an action or
 * skip a step — for example approving a request the bank already rejected.
 */
export function assertTransition<S extends string>(
  current: S,
  allowedFrom: readonly S[],
  what: string,
): void {
  if (!allowedFrom.includes(current)) {
    throw conflict(`${what} در وضعیت فعلی امکان‌پذیر نیست`);
  }
}
