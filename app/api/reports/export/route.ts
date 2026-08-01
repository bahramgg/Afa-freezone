import { z } from "zod";
import { handler, readQuery, requireUser } from "@/lib/server/http";
import { buildReport, DATASET_KEYS } from "@/lib/server/reports/export";
import type { DatasetKey } from "@/lib/server/reports/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  dataset: z.enum(DATASET_KEYS as [DatasetKey, ...DatasetKey[]]),
});

/**
 * Streams a report as a real .xlsx workbook. Which datasets a caller may ask
 * for, and which rows land in them, both come from the session — the query
 * string only picks between the exports that role already has.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { dataset } = readQuery(request, Query);

  const { buffer, filename } = await buildReport(user, dataset);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(buffer.byteLength),
      "cache-control": "no-store",
    },
  });
});
