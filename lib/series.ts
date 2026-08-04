import { dayjs } from "./jalali";

/**
 * Chart data, derived from what the system actually holds.
 *
 * Every chart in the organization's and the bank's panels used to come from a
 * fixtures file: fixed月 labels, invented volumes, a currency split of 82/18
 * that no query produced. On a page an official reads as a report, that is not
 * a placeholder — it is a number they might repeat somewhere it matters.
 *
 * So these take the same lists the pages already load and count them. Where the
 * system has no history to count — an exchange rate nobody recorded — there is
 * no function here, and the chart is gone rather than filled in.
 */

/** The last `months` Jalali months, oldest first, as buckets to fill. */
export function monthBuckets(months = 6) {
  const now = dayjs();
  return Array.from({ length: months }, (_, i) => {
    const at = now.subtract(months - 1 - i, "month");
    return {
      /** Jalali month name, which is what a Persian reader expects on an axis. */
      month: at.calendar("jalali").format("MMMM"),
      /** Bucket key: the Jalali year and month it belongs to. */
      key: at.calendar("jalali").format("YYYY-MM"),
    };
  });
}

const bucketOf = (iso: string) => dayjs(iso).calendar("jalali").format("YYYY-MM");

type Dated = { createdAt?: string; joinedAt?: string; date?: string };
const when = (row: Dated) => row.createdAt ?? row.joinedAt ?? row.date ?? "";

/**
 * Monthly totals of whatever `value` pulls out of each row.
 *
 * Rows outside the window are dropped rather than piled into the first bucket —
 * a bar that silently absorbs two years of history is worse than a short chart.
 */
export function monthlyTotals<T extends Dated>(
  rows: T[],
  series: Record<string, (row: T) => number>,
  months = 6,
) {
  const buckets = monthBuckets(months);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const keys = Object.keys(series);

  const out = buckets.map((b) => ({
    month: b.month,
    ...Object.fromEntries(keys.map((k) => [k, 0])),
  })) as ({ month: string } & Record<string, number>)[];

  for (const row of rows) {
    const stamp = when(row);
    if (!stamp) continue;
    const at = index.get(bucketOf(stamp));
    if (at === undefined) continue;
    for (const key of keys) out[at]![key] = (out[at]![key] ?? 0) + series[key]!(row);
  }
  return out;
}

/** Running count at the end of each month — a growth curve, not a per-month bar. */
export function monthlyCumulative<T extends Dated>(rows: T[], months = 6) {
  const buckets = monthBuckets(months);
  return buckets.map((b) => ({
    month: b.month,
    users: rows.filter((r) => {
      const stamp = when(r);
      return stamp && bucketOf(stamp) <= b.key;
    }).length,
  }));
}

/** Daily totals over the last `days`, oldest first. */
export function dailyTotals<T extends Dated>(
  rows: T[],
  series: Record<string, (row: T) => number>,
  days = 30,
) {
  const now = dayjs();
  const keys = Object.keys(series);
  const buckets = Array.from({ length: days }, (_, i) => {
    const at = now.subtract(days - 1 - i, "day");
    return { date: at.toISOString(), key: at.format("YYYY-MM-DD") };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  const out = buckets.map((b) => ({
    date: b.date,
    ...Object.fromEntries(keys.map((k) => [k, 0])),
  })) as ({ date: string } & Record<string, number>)[];

  for (const row of rows) {
    const stamp = when(row);
    if (!stamp) continue;
    const at = index.get(dayjs(stamp).format("YYYY-MM-DD"));
    if (at === undefined) continue;
    for (const key of keys) out[at]![key] = (out[at]![key] ?? 0) + series[key]!(row);
  }
  return out;
}

/**
 * How the volume splits between the settled token and the native coin.
 *
 * Returns an empty list when there is nothing to divide, so a chart can say
 * "no data yet" instead of drawing a circle out of nothing.
 */
export function currencySplit(
  rows: { currency: string; amount: number }[],
  labelFor: (currency: string) => string,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, value], index) => ({
      name: labelFor(currency),
      value: Math.round((value / sum) * 100),
      index,
    }));
}

/**
 * Where a record ended up, in the three groups a report cares about.
 *
 * Anything not finished and not refused is waiting — including `CANCELLING`,
 * where the importer's rial has not gone back yet. Calling that one "settled"
 * would hide the only status that means somebody still owes somebody money.
 */
export function outcome(status: string): "done" | "waiting" | "refused" {
  if (status === "PAID" || status === "SETTLED") return "done";
  if (status === "REJECTED" || status === "EXPIRED" || status === "CANCELLED") return "refused";
  return "waiting";
}

const OUTCOME_LABELS = { done: "موفق", waiting: "در انتظار", refused: "رد شده" } as const;

/**
 * The share of records in each outcome, counted rather than weighted — a
 * hundred small invoices and one large one say different things about volume
 * but the same thing about how often the flow completes.
 *
 * Empty groups are dropped, and each entry carries the index of its group so a
 * chart keeps green on "موفق" however many groups survive.
 */
export function outcomeSplit(rows: { status: string }[]) {
  const order = ["done", "waiting", "refused"] as const;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = outcome(row.status);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (rows.length === 0) return [];
  return order
    .map((key, index) => ({
      name: OUTCOME_LABELS[key],
      value: Math.round(((counts.get(key) ?? 0) / rows.length) * 100),
      index,
    }))
    .filter((entry) => entry.value > 0);
}
