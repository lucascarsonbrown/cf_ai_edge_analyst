import { generateReportId } from "../utils/ids";
import { json, errorResponse } from "../utils/responses";
import { validateTicker, validateFocusPrompt } from "../utils/validation";
import type { Env, AnalyzeRequest } from "../types";

/**
 * POST /api/analyze
 *
 * Creates a new report, initializes Durable Object state,
 * and triggers the ReportWorkflow.
 */
export async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  let body: Partial<AnalyzeRequest>;

  try {
    body = (await request.json()) as Partial<AnalyzeRequest>;
  } catch {
    return errorResponse("Request body must be valid JSON", "INVALID_JSON");
  }

  const tickerResult = validateTicker(body.ticker);
  if (!tickerResult.valid) {
    return errorResponse(tickerResult.error, "INVALID_TICKER");
  }

  const { ticker } = tickerResult;
  const focusPrompt = validateFocusPrompt(body.focusPrompt);
  const reportId = generateReportId();

  // Initialize Durable Object state for this report
  const doId = env.REPORT_STATE.idFromName(reportId);
  const stub = env.REPORT_STATE.get(doId);

  await stub.fetch("https://do/init", {
    method: "POST",
    body: JSON.stringify({ id: reportId, ticker, focusPrompt }),
  });

  // Trigger the Workflow — runs independently in the background
  await env.REPORT_WORKFLOW.create({
    id: reportId,
    params: { reportId, ticker, focusPrompt },
  });

  return json({ reportId, status: "queued" }, 202);
}
