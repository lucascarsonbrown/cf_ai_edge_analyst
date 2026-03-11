import { formatContextForPrompt } from "./lib/companyContext";
import type { CompanyContext, ChatMessage, ReportSections } from "./types";

// ─── Shared system persona ────────────────────────────────────────────────────

const ANALYST_PERSONA = `You are a senior equity research analyst. Your writing is concise, balanced, and analytical.
You use markdown formatting with clear headings and bullet points.
You ground your analysis in the quantitative and qualitative data provided — do not fabricate metrics.
You reason from the context given and stay internally consistent across sections.`;

// ─── Section prompts ──────────────────────────────────────────────────────────

export function overviewPrompt(ctx: CompanyContext, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

${formatContextForPrompt(ctx)}
${focusPrompt ? `\nANALYST FOCUS: ${focusPrompt}` : ""}

Write a ## Company Overview section for an investment memo on ${ctx.ticker}.
Cover what the company does, its market position, and why it matters to investors right now.
Reference specific data points from the context above where relevant (revenue, market cap, sector trends).
Be concise — 3 to 5 bullet points or a short paragraph. Use markdown.`;
}

export function bullCasePrompt(ctx: CompanyContext, overview: string, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

${formatContextForPrompt(ctx)}
${focusPrompt ? `\nANALYST FOCUS: ${focusPrompt}` : ""}

Company Overview (already written):
${overview}

Write a ## Bull Case section. Present the 3–4 strongest reasons an investor would be optimistic.
Back each point with specific evidence from the data above — analyst ratings, earnings beats, revenue growth, margins, or news.
Be specific. Use bullet points. Use markdown.`;
}

export function bearCasePrompt(ctx: CompanyContext, overview: string, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

${formatContextForPrompt(ctx)}
${focusPrompt ? `\nANALYST FOCUS: ${focusPrompt}` : ""}

Company Overview (already written):
${overview}

Write a ## Bear Case section. Present the 3–4 strongest reasons an investor would be skeptical or cautious.
Reference valuation multiples, debt levels, earnings misses, or concerning news items from the data above.
Be specific and honest. Use bullet points. Use markdown.`;
}

export function keyRisksPrompt(
  ctx: CompanyContext,
  bullCase: string,
  bearCase: string,
  focusPrompt?: string
): string {
  return `${ANALYST_PERSONA}

${formatContextForPrompt(ctx)}
${focusPrompt ? `\nANALYST FOCUS: ${focusPrompt}` : ""}

Bull Case (already written):
${bullCase}

Bear Case (already written):
${bearCase}

Write a ## Key Risks section. List the top 3–5 risks an investor must understand before taking a position.
Include both company-specific risks (debt/equity ratio, earnings volatility, recent 8-K filings) and macro/sector risks.
Ground each risk in the data provided. Use bullet points. Use markdown.`;
}

export function conclusionPrompt(
  ctx: CompanyContext,
  overview: string,
  bullCase: string,
  bearCase: string,
  keyRisks: string,
  focusPrompt?: string
): string {
  return `${ANALYST_PERSONA}

${formatContextForPrompt(ctx)}
${focusPrompt ? `\nANALYST FOCUS: ${focusPrompt}` : ""}

Previously written sections:
## Company Overview
${overview}

## Bull Case
${bullCase}

## Bear Case
${bearCase}

## Key Risks
${keyRisks}

Write two final sections:

## What to Watch
List 3–4 specific catalysts, data points, or upcoming events investors should monitor.
Reference upcoming earnings periods, recent filings, or news themes from the data above.

## Bottom Line
Write 2–4 sentences with a direct, balanced verdict. Reference the analyst consensus and valuation context.
What kind of investor should be interested, and at what conviction level? Do not be hypey.

Use markdown.`;
}

export function finalMemoPrompt(
  ctx: CompanyContext,
  sections: Required<Omit<ReportSections, "finalMemo">>,
  focusPrompt?: string
): string {
  return `${ANALYST_PERSONA}

Assemble the following sections into a single clean, well-formatted investment memo for ${ctx.ticker} (${ctx.name}).
Ensure consistent tone and flow. Do not add new analysis — refine transitions only.
${focusPrompt ? `\nAnalyst focus throughout: ${focusPrompt}` : ""}

## Company Overview
${sections.overview}

## Bull Case
${sections.bullCase}

## Bear Case
${sections.bearCase}

## Key Risks
${sections.keyRisks}

## What to Watch
${sections.whatToWatch}

## Bottom Line
${sections.bottomLine}

Return the full assembled memo in clean markdown.
Start with: # ${ctx.ticker} — Investment Memo
Include a one-line italicized subtitle with the sector and data sources used: _${ctx.sector} | Sources: ${ctx.dataSources.join(", ")}_`;
}

// ─── Chat prompt ──────────────────────────────────────────────────────────────

export function chatPrompt(
  ticker: string,
  focusPrompt: string | undefined,
  finalMemo: string,
  history: ChatMessage[],
  userMessage: string
): string {
  const historyText = history
    .map((m) => `${m.role === "user" ? "User" : "Analyst"}: ${m.content}`)
    .join("\n");

  return `${ANALYST_PERSONA}

You are answering follow-up questions about an investment memo you wrote for ${ticker}.
${focusPrompt ? `The original analyst focus was: ${focusPrompt}` : ""}

--- MEMO ---
${finalMemo}
--- END MEMO ---

${history.length > 0 ? `Prior conversation:\n${historyText}\n` : ""}
User: ${userMessage}

Respond as the analyst. Be concise and direct. Reference specific data points from the memo where relevant. Use markdown if helpful.`;
}
