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
  switch (user.role) {
    case "ADMIN":
      return {};
    case "BANK":
      // The bank prices and funds imports, so it sees those once cleared.
      return { direction: "IMPORT", status: { notIn: ["PENDING", "REJECTED"] } };
    default:
      // Everyone else sees both sides of their own trades: what they raised,
      // and what was raised against them.
      return { OR: [{ ownerId: user.id }, { counterpartyId: user.id }] };
  }
}


export function settlementScope(user: SessionUser): Prisma.SettlementWhereInput {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "SUPERADMIN":
      // Runs the system, not the trades: no business rows at all.
      return { ownerId: NOTHING };
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
