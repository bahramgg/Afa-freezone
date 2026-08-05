import "server-only";
import { db } from "./db";
import { clientIp } from "./http";

/**
 * Records an act, as opposed to a movement of money.
 *
 * StatusEvent already carries every step a trade takes. This carries the things
 * around it that have no trade to attach to — a sign-in, an account disabled, an
 * address let onto the allowlist — which otherwise happen and leave nothing
 * behind at all.
 *
 * Fire-and-forget: an audit write that fails must not undo the thing it was
 * describing, and a login that succeeded should not report failure because a
 * log row could not be written.
 */
export type AuditAction =
  | "LOGIN_CODE_SENT"
  | "LOGIN_SUCCEEDED"
  | "LOGIN_VIA_LINK"
  | "LOGOUT"
  | "REGISTERED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "USER_ROLE_CHANGED"
  | "ALLOWLIST_ADDED"
  | "ALLOWLIST_REMOVED"
  | "ALLOWLIST_ROLE_CHANGED"
  | "REGISTRATION_POLICY_CHANGED"
  /** A deposit nobody's invoice claimed, taken on by an operator or released. */
  | "CHAINTX_FLAGGED"
  | "CHAINTX_UNFLAGGED";

export async function audit(
  action: AuditAction,
  input: {
    request?: Request;
    actorId?: string | null;
    subject?: string | null;
    detail?: string | null;
  } = {},
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        actorId: input.actorId ?? null,
        subject: input.subject ?? null,
        detail: input.detail ?? null,
        ip: input.request ? clientIp(input.request) : null,
        userAgent: input.request?.headers.get("user-agent") ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] could not record", action, error);
  }
}
