import { json, errorResponse } from "../utils/responses";
import type { Env } from "../types";

/**
 * GET /api/report/:id
 *
 * Returns the full current state of a report from its Durable Object.
 * The frontend polls this endpoint every 2 seconds during generation.
 */
export async function handleReport(reportId: string, env: Env): Promise<Response> {
  if (!reportId) {
    return errorResponse("Report ID is required", "MISSING_ID");
  }

  const doId = env.REPORT_STATE.idFromName(reportId);
  const stub = env.REPORT_STATE.get(doId);

  const doRes = await stub.fetch("https://do/get");

  if (doRes.status === 404) {
    return errorResponse("Report not found", "NOT_FOUND", 404);
  }

  const report = await doRes.json();
  return json(report);
}
