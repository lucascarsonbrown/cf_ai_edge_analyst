import { json, errorResponse } from "../utils/responses";
import { validateMessage } from "../utils/validation";
import { callAI } from "../lib/ai";
import { chatPrompt } from "../prompts";
import { MAX_TOKENS_CHAT } from "../config";
import { now } from "../utils/time";
import type { Env, ReportState, ChatRequest, ChatMessage } from "../types";

/**
 * POST /api/chat/:id
 *
 * Accepts a follow-up question, builds LLM context from the generated
 * memo and prior chat history, calls Workers AI, and persists the exchange.
 */
export async function handleChat(reportId: string, request: Request, env: Env): Promise<Response> {
  if (!reportId) {
    return errorResponse("Report ID is required", "MISSING_ID");
  }

  let body: Partial<ChatRequest>;
  try {
    body = (await request.json()) as Partial<ChatRequest>;
  } catch {
    return errorResponse("Request body must be valid JSON", "INVALID_JSON");
  }

  const msgResult = validateMessage(body.message);
  if (!msgResult.valid) {
    return errorResponse(msgResult.error, "INVALID_MESSAGE");
  }

  const { message } = msgResult;

  // Load report state from Durable Object
  const doId = env.REPORT_STATE.idFromName(reportId);
  const stub = env.REPORT_STATE.get(doId);
  const doRes = await stub.fetch("https://do/get");

  if (doRes.status === 404) {
    return errorResponse("Report not found", "NOT_FOUND", 404);
  }

  const report = (await doRes.json()) as ReportState;

  // Require memo to be complete before allowing chat
  if (report.status !== "complete") {
    return errorResponse(
      "Report generation is not yet complete. Please wait before sending follow-up questions.",
      "REPORT_NOT_READY",
      409
    );
  }

  const finalMemo = report.sections.finalMemo;
  if (!finalMemo) {
    return errorResponse("Final memo is missing", "MEMO_MISSING", 500);
  }

  // Build prompt and call AI
  const prompt = chatPrompt(
    report.ticker,
    report.focusPrompt,
    finalMemo,
    report.chatHistory,
    message
  );

  const reply = await callAI(env, prompt, MAX_TOKENS_CHAT);

  // Persist both sides of the exchange to the Durable Object
  const newMessages: ChatMessage[] = [
    { role: "user", content: message, timestamp: now() },
    { role: "assistant", content: reply, timestamp: now() },
  ];

  const appendRes = await stub.fetch("https://do/append-chat", {
    method: "POST",
    body: JSON.stringify(newMessages),
  });

  const { chatHistory } = (await appendRes.json()) as { chatHistory: ChatMessage[] };

  return json({ reply, chatHistory });
}
