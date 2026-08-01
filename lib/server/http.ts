import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { currentUser, roleAllows, type SessionUser } from "./auth/session";
import type { Role } from "@/lib/generated/prisma/client";

/**
 * Route handlers throw ApiError instead of assembling responses inline, so the
 * failure shape stays identical everywhere and the client can rely on it.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "ابتدا وارد حساب کاربری خود شوید") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message = "شما به این بخش دسترسی ندارید") =>
  new ApiError(403, "forbidden", message);
export const notFound = (message = "موردی یافت نشد") =>
  new ApiError(404, "not_found", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const tooManyRequests = (message: string) =>
  new ApiError(429, "too_many_requests", message);

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_failed",
          message: "اطلاعات ارسالی معتبر نیست",
          details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }

  // Anything unrecognised is a bug: log it server-side, tell the client nothing.
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { ok: false, error: { code: "internal_error", message: "خطای غیرمنتظره در سرور" } },
    { status: 500 },
  );
}

/** Wraps a handler so thrown ApiError/ZodError become proper responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roleAllows(user.role, allowed)) throw forbidden();
  return user;
}

/** Merchant endpoints additionally require a passed KYC review. */
export async function requireApprovedMerchant(...allowed: Role[]): Promise<SessionUser> {
  const user = await requireRole(...allowed);
  if (user.kyc !== "APPROVED") {
    throw new ApiError(403, "kyc_required", "برای این عملیات باید احراز هویت شما تأیید شده باشد");
  }
  return user;
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("بدنه درخواست باید JSON معتبر باشد");
  }
  return schema.parse(raw);
}

export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
