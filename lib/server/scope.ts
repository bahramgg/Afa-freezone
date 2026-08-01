import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { SessionUser } from "./auth/session";

/**
 * Row-level visibility, defined once.
 *
 * Each function answers "which rows may this session see at all", derived
 * entirely from the session. Callers that additionally honour a client filter
 * must combine with `narrow` rather than assigning onto the same key: writing
 * a client `status` straight onto `where.status` overwrites the scope, and a
 * bank asking for a status outside its queue would be handed rows the admin
 * has not cleared yet.
 */

/** Matches nothing. Used where a role has no business seeing a table at all. */
const NOTHING = "__none__";

export function invoiceScope(user: SessionUser): Prisma.InvoiceWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "IRANIAN") return { ownerId: user.id };
  return { ownerId: NOTHING };
}

export function sendScope(user: SessionUser): Prisma.SendRequestWhereInput {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "IRANIAN":
      return { ownerId: user.id };
    case "FOREIGN":
      return { OR: [{ counterpartyId: user.id }, { counterpartyUid: user.uid }] };
    case "BANK":
      // The bank only ever sees requests admin has already cleared.
      return {
        status: {
          in: [
            "AWAITING_BANK_REVIEW",
            "BANK_RATE_LOCKED",
            "RIAL_RECEIVED",
            "CRYPTO_SENT",
            "PAID",
            "REJECTED",
          ],
        },
      };
  }
}

export function settlementScope(user: SessionUser): Prisma.SettlementWhereInput {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "IRANIAN":
      return { ownerId: user.id };
    case "BANK":
      return {
        status: {
          in: [
            "AWAITING_BANK",
            "BANK_RATE_LOCKED",
            "CRYPTO_RECEIVED",
            "CRYPTO_CONFIRMED",
            "SETTLED",
            "REJECTED",
          ],
        },
      };
    case "FOREIGN":
      return { ownerId: NOTHING };
  }
}

/**
 * Intersects a session scope with a caller-supplied filter. Nesting under `AND`
 * means the filter can only ever remove rows, never add them back.
 */
export function narrow<T extends object>(scope: T, ...filters: (T | undefined | null)[]): T {
  const extra = filters.filter(Boolean) as T[];
  if (extra.length === 0) return scope;
  return { AND: [scope, ...extra] } as unknown as T;
}
