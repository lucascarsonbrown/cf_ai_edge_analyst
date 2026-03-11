import type { CompanyContext, ChatMessage, ReportSections } from "./types";

// ─── Shared system persona ────────────────────────────────────────────────────

const ANALYST_PERSONA = `You are a senior equity research analyst. Your writing is concise, balanced, and analytical.
You use markdown formatting with clear headings and bullet points.
You do not fabricate specific financial metrics unless they are provided to you.
You reason from the context given and stay internally consistent.`;

// ─── Section prompts ──────────────────────────────────────────────────────────

export function overviewPrompt(ctx: CompanyContext, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

Company context:
- Ticker: ${ctx.ticker}
- Name: ${ctx.name}
- Sector: ${ctx.sector}
- Industry: ${ctx.industry}
- Description: ${ctx.description}
${ctx.marketCap ? `- Market Cap: ${ctx.marketCap}` : ""}
${ctx.peRatio ? `- P/E Ratio: ${ctx.peRatio}` : ""}
${ctx.weekHigh52 ? `- 52-Week High: ${ctx.weekHigh52}` : ""}
${ctx.weekLow52 ? `- 52-Week Low: ${ctx.weekLow52}` : ""}
${ctx.analystTarget ? `- Analyst Target Price: ${ctx.analystTarget}` : ""}
${focusPrompt ? `\nAnalyst focus: ${focusPrompt}` : ""}

Write a ## Company Overview section for an investment memo on ${ctx.ticker}.
Cover what the company does, its market position, and why it matters to investors right now.
Be concise — 3 to 5 bullet points or a short paragraph. Use markdown.`;
}

export function bullCasePrompt(ctx: CompanyContext, overview: string, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

You are writing a section of an investment memo for ${ctx.ticker} (${ctx.name}).

Company Overview (already written):
${overview}
${focusPrompt ? `\nAnalyst focus: ${focusPrompt}` : ""}

Write a ## Bull Case section. Present the 3–4 strongest reasons an investor would be optimistic.
Be specific to this company. Use bullet points. Use markdown.`;
}

export function bearCasePrompt(ctx: CompanyContext, overview: string, focusPrompt?: string): string {
  return `${ANALYST_PERSONA}

You are writing a section of an investment memo for ${ctx.ticker} (${ctx.name}).

Company Overview (already written):
${overview}
${focusPrompt ? `\nAnalyst focus: ${focusPrompt}` : ""}

Write a ## Bear Case section. Present the 3–4 strongest reasons an investor would be skeptical or cautious.
Be specific and honest. Use bullet points. Use markdown.`;
}

export function keyRisksPrompt(
  ctx: CompanyContext,
  bullCase: string,
  bearCase: string,
  focusPrompt?: string
): string {
  return `${ANALYST_PERSONA}

You are writing a section of an investment memo for ${ctx.ticker} (${ctx.name}).

Bull Case (already written):
${bullCase}

Bear Case (already written):
${bearCase}
${focusPrompt ? `\nAnalyst focus: ${focusPrompt}` : ""}

Write a ## Key Risks section. List the top 3–5 risks an investor should understand before taking a position.
Include both company-specific and macro/sector risks where relevant. Use bullet points. Use markdown.`;
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

You are finishing an investment memo for ${ctx.ticker} (${ctx.name}).

Previously written sections:
## Company Overview
${overview}

## Bull Case
${bullCase}

## Bear Case
${bearCase}

## Key Risks
${keyRisks}
${focusPrompt ? `\nAnalyst focus: ${focusPrompt}` : ""}

Write two final sections:

## What to Watch
List 3–4 specific catalysts, data points, or events investors should monitor in the next 1–2 quarters.

## Bottom Line
Write 2–4 sentences summarizing your overall view. Be direct. Do not be hypey.
What kind of investor should be interested, and at what conviction level?

Use markdown.`;
}

export function finalMemoPrompt(
  ctx: CompanyContext,
  sections: Required<Omit<ReportSections, "finalMemo">>,
  focusPrompt?: string
): string {
  return `${ANALYST_PERSONA}

Assemble the following sections into a single clean, well-formatted investment memo for ${ctx.ticker}.
Ensure consistent tone and flow. Do not add new analysis — just refine transitions and ensure the memo reads as one coherent document.
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

Return the full assembled memo in clean markdown. Start with a top-level heading: # ${ctx.ticker} — Investment Memo`;
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

Respond as the analyst. Be concise and direct. Reference the memo where relevant. Use markdown if helpful.`;
}
