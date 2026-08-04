import "server-only";
import { tooManyRequests } from "./http";

/**
 * A ceiling on how often one caller may do something expensive.
 *
 * The OTP flow already refuses to resend to the same address inside a minute,
 * which stops a person hammering their own inbox. It does nothing about one
 * caller walking a list of ten thousand addresses: every one is a first
 * request, every one passes, and every one is a real email leaving a real
 * account. That costs money and burns the sending domain's reputation, which is
 * far harder to get back than the money.
 *
 * Deliberately in memory. A payment gateway runs on a handful of instances, and
 * a per-instance ceiling divides the damage by however many there are rather
 * than eliminating it — which is the right trade against adding Redis to the
 * critical path of signing in. Move it to a shared store when the fleet grows
 * enough that the arithmetic stops working.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound on a long-lived process. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export function rateLimit(
  key: string,
  { limit, windowMs, message }: { limit: number; windowMs: number; message: string },
): void {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw tooManyRequests(`${message} — ${seconds} ثانیه دیگر دوباره تلاش کنید`);
  }
}

/** Test seam: the buckets are process-wide and would otherwise leak between runs. */
export function resetRateLimits() {
  buckets.clear();
}
