# PROMPTS.md

All AI prompt templates used in `cf_ai_edge_analyst`, including their purpose, location in the codebase, and design rationale.

---

## Shared Persona

**File:** `src/prompts.ts` — `ANALYST_PERSONA` constant

**Used in:** Every prompt as a system-level preamble.

```
You are a senior equity research analyst. Your writing is concise, balanced, and analytical.
You use markdown formatting with clear headings and bullet points.
You do not fabricate specific financial metrics unless they are provided to you.
You reason from the context given and stay internally consistent.
```

**Design notes:**
- Injected at the top of every prompt to maintain consistent tone across all 6+ LLM calls.
- The "do not fabricate metrics" instruction is critical — the model should reason qualitatively, not hallucinate P/E ratios or revenue figures.

---

## 1. Company Overview Prompt

**File:** `src/prompts.ts` — `overviewPrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `generateOverview()`
**Workflow step:** Step 3

**Purpose:** Generate a concise company description and market position summary to anchor the rest of the memo.

**Template:**
```
{ANALYST_PERSONA}

Company context:
- Ticker: {ticker}
- Name: {name}
- Sector: {sector}
- Industry: {industry}
- Description: {description}
[optional: Market Cap, P/E, 52-week range, analyst target]
[optional: Analyst focus: {focusPrompt}]

Write a ## Company Overview section for an investment memo on {ticker}.
Cover what the company does, its market position, and why it matters to investors right now.
Be concise — 3 to 5 bullet points or a short paragraph. Use markdown.
```

**Design notes:**
- All available company context from Alpha Vantage is injected here.
- The focus prompt (if provided by the user) is included to bias the overview toward the user's stated interest.
- Kept concise by design — the overview is context for later sections, not the final product.

---

## 2. Bull Case Prompt

**File:** `src/prompts.ts` — `bullCasePrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `generateBullCase()`
**Workflow step:** Step 4

**Purpose:** Generate the strongest optimistic investment thesis for the given ticker.

**Template:**
```
{ANALYST_PERSONA}

You are writing a section of an investment memo for {ticker} ({name}).

Company Overview (already written):
{overview}
[optional: Analyst focus: {focusPrompt}]

Write a ## Bull Case section. Present the 3–4 strongest reasons an investor would be optimistic.
Be specific to this company. Use bullet points. Use markdown.
```

**Design notes:**
- Receives the already-generated overview as context to avoid repetition.
- Asks for 3–4 specific reasons to keep output structured and scannable.
- Intentionally one-sided: a separate prompt handles the bear case to prevent the model from self-moderating too early.

---

## 3. Bear Case Prompt

**File:** `src/prompts.ts` — `bearCasePrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `generateBearCase()`
**Workflow step:** Step 5

**Purpose:** Generate the strongest skeptical or cautious investment thesis.

**Template:**
```
{ANALYST_PERSONA}

You are writing a section of an investment memo for {ticker} ({name}).

Company Overview (already written):
{overview}
[optional: Analyst focus: {focusPrompt}]

Write a ## Bear Case section. Present the 3–4 strongest reasons an investor would be skeptical or cautious.
Be specific and honest. Use bullet points. Use markdown.
```

**Design notes:**
- Mirrors the bull case structure intentionally — equal weight, separate call.
- The word "honest" pushes the model toward genuine critique rather than softened hedging.
- Does not receive the bull case as context, keeping the two cases independently generated to avoid anchoring.

---

## 4. Key Risks Prompt

**File:** `src/prompts.ts` — `keyRisksPrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `generateKeyRisks()`
**Workflow step:** Step 6

**Purpose:** Synthesize the top risks from both the bull and bear cases, plus any additional risks not yet covered.

**Template:**
```
{ANALYST_PERSONA}

You are writing a section of an investment memo for {ticker} ({name}).

Bull Case (already written):
{bullCase}

Bear Case (already written):
{bearCase}
[optional: Analyst focus: {focusPrompt}]

Write a ## Key Risks section. List the top 3–5 risks an investor should understand before taking a position.
Include both company-specific and macro/sector risks where relevant. Use bullet points. Use markdown.
```

**Design notes:**
- Receives both the bull and bear cases so it can synthesize and avoid redundancy.
- Explicitly asks for both company-specific and macro risks to ensure breadth.
- Positioned after both cases in the workflow to have the most context.

---

## 5. Conclusion Prompt (What to Watch + Bottom Line)

**File:** `src/prompts.ts` — `conclusionPrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `generateConclusion()`
**Workflow step:** Step 7

**Purpose:** Generate the two closing sections of the memo in one call — forward-looking catalysts and a crisp overall verdict.

**Template:**
```
{ANALYST_PERSONA}

You are finishing an investment memo for {ticker} ({name}).

Previously written sections:
## Company Overview
{overview}

## Bull Case
{bullCase}

## Bear Case
{bearCase}

## Key Risks
{keyRisks}
[optional: Analyst focus: {focusPrompt}]

Write two final sections:

## What to Watch
List 3–4 specific catalysts, data points, or events investors should monitor in the next 1–2 quarters.

## Bottom Line
Write 2–4 sentences summarizing your overall view. Be direct. Do not be hypey.
What kind of investor should be interested, and at what conviction level?

Use markdown.
```

**Design notes:**
- Receives all prior sections as context — this is the highest-context call in the pipeline.
- "Do not be hypey" is an explicit instruction to counteract the model's tendency toward positive framing.
- The "what kind of investor" framing pushes the model toward actionable, audience-specific conclusions.
- Two sections in one call reduces latency while keeping the output coherent.
- The response is split on `## What to Watch` / `## Bottom Line` regex markers in `memoBuilder.ts`.

---

## 6. Final Memo Synthesis Prompt

**File:** `src/prompts.ts` — `finalMemoPrompt()`
**Used in:** `src/lib/memoBuilder.ts` → `synthesizeFinalMemo()`
**Workflow step:** Step 8

**Purpose:** Assemble all six sections into a single, coherent, well-flowing investment memo document.

**Template:**
```
{ANALYST_PERSONA}

Assemble the following sections into a single clean, well-formatted investment memo for {ticker}.
Ensure consistent tone and flow. Do not add new analysis — just refine transitions and ensure
the memo reads as one coherent document.
[optional: Analyst focus throughout: {focusPrompt}]

## Company Overview
{overview}

## Bull Case
{bullCase}

## Bear Case
{bearCase}

## Key Risks
{keyRisks}

## What to Watch
{whatToWatch}

## Bottom Line
{bottomLine}

Return the full assembled memo in clean markdown.
Start with a top-level heading: # {ticker} — Investment Memo
```

**Design notes:**
- "Do not add new analysis" is a strict instruction — this step is an editor, not a generator.
- The synthesized output is what gets stored as `finalMemo` in the Durable Object and rendered in the UI.
- This step could be skipped (just concatenating sections) but the synthesis call meaningfully improves flow and catches tone inconsistencies.

---

## 7. Follow-up Chat Prompt

**File:** `src/prompts.ts` — `chatPrompt()`
**Used in:** `src/routes/chat.ts`
**Workflow step:** N/A — called directly from the chat route handler

**Purpose:** Answer user follow-up questions using the generated memo and prior conversation history as context.

**Template:**
```
{ANALYST_PERSONA}

You are answering follow-up questions about an investment memo you wrote for {ticker}.
[optional: The original analyst focus was: {focusPrompt}]

--- MEMO ---
{finalMemo}
--- END MEMO ---

[Prior conversation if any:]
User: {message}
Analyst: {reply}
...

User: {newUserMessage}

Respond as the analyst. Be concise and direct. Reference the memo where relevant. Use markdown if helpful.
```

**Design notes:**
- The full `finalMemo` is injected as context so the model can reference specific sections.
- Prior chat history is included verbatim so the model maintains conversational continuity.
- Delimiters (`--- MEMO ---`) help the model clearly distinguish the memo from the conversation.
- Max tokens is lower for chat (500) than for section generation (600) to keep replies tight.

---

## Notes on Prompt Engineering Choices

1. **One prompt per section, not one giant prompt.** Each section is generated independently. This improves quality, enables step-by-step status tracking, and allows partial memos to be useful even if later steps fail.

2. **Context chaining.** Each prompt receives the output of prior steps as context. Overview → Bull/Bear → Risks → Conclusion → Synthesis is a deliberate dependency chain that ensures each section builds on what came before.

3. **Explicit format instructions.** Every prompt ends with "Use markdown" and specifies the desired length/structure. LLMs follow explicit formatting constraints more reliably than implicit ones.

4. **Anti-hallucination guardrails.** The persona explicitly states "do not fabricate specific financial metrics." This is reinforced by passing structured company context (from Alpha Vantage) rather than asking the model to recall facts.

5. **Focus prompt injection.** The user's optional focus note is passed into every section prompt, allowing the analysis to be biased toward the stated interest (e.g. "valuation risk") without overriding the structured format.
