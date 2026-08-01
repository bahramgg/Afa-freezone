"use client";

/**
 * Thin fetch wrapper over the route handlers. Every response follows the same
 * `{ ok, data | error }` envelope, so callers get either the payload or an
 * ApiClientError carrying the Persian message the server already produced.
 */

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** True when the caller simply is not signed in — not worth toasting. */
  get isUnauthorized() {
    return this.status === 401;
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: ApiErrorShape };

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const response = await fetch(`/api${path}`, {
    ...rest,
    // Session lives in an httpOnly cookie; it must ride along on every call.
    credentials: "same-origin",
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(
      response.status,
      "invalid_response",
      "پاسخ سرور قابل خواندن نبود",
    );
  }

  if (!payload.ok) {
    throw new ApiClientError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }
  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json }),
  patch: <T>(path: string, json?: unknown) => request<T>(path, { method: "PATCH", json }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Builds a query string, dropping empty values so `?status=` never appears. */
export function query(params: Record<string, string | number | undefined | null>) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}
