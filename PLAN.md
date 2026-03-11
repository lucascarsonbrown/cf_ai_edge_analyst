# cf_ai_edge_analyst — Implementation Plan

## Project Summary
An AI-powered equity research assistant built on Cloudflare's developer platform. Users enter a stock ticker and optional focus prompt, and the system generates a structured investment memo using a multi-step Workflow, Durable Object state, and Workers AI (Llama 3.3). After generation, users can ask follow-up questions in a chat interface.

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Orchestration | Cloudflare Workflows (`WorkflowEntrypoint`) | Showcase CF-native primitive |
| Frontend hosting | Cloudflare Pages (separate deployment) | Showcase CF Pages |
| LLM | llama-3.3-70b-instruct-fp8-fast → fallback llama-3.1-8b | Quality with resilience |
| State | Durable Objects (one per report) | CF-native persistent state |
| Company data | Alpha Vantage `OVERVIEW` endpoint + graceful fallback | Lightweight, real data |
| Frontend stack | Vanilla HTML/CSS/JS | Simple, no build step |
| Status updates | Polling every 2s | Reliable across CF infrastructure |
| Routing | Plain URL pattern matching | Only 3 routes, no framework needed |

---

## Cloudflare Products Used

- **Workers** — API layer (analyze, report, chat routes)
- **Workers AI** — LLM calls for memo generation and chat
- **Workflows** — Multi-step memo generation orchestration
- **Durable Objects** — Per-report state, sections, chat history
- **Pages** — Hosts static HTML/CSS/JS frontend

---

## Bindings (wrangler.jsonc)

| Binding | Type | Name in code |
|---|---|---|
| Workers AI | AI | `env.AI` |
| Durable Object | DO namespace | `env.REPORT_STATE` |
| Workflow | Workflow | `env.REPORT_WORKFLOW` |
| Alpha Vantage key | Secret | `env.ALPHA_VANTAGE_API_KEY` |

---

## File Tree

```
cf_ai_edge_analyst/
├── README.md
├── PROMPTS.md
├── PLAN.md
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── .gitignore
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── prompts.ts
│   ├── config.ts
│   ├── utils/
│   │   ├── ids.ts
│   │   ├── responses.ts
│   │   ├── validation.ts
│   │   └── time.ts
│   ├── lib/
│   │   ├── ai.ts
│   │   ├── companyContext.ts
│   │   └── memoBuilder.ts
│   ├── workflows/
│   │   └── reportWorkflow.ts
│   ├── durable/
│   │   └── ReportStateDO.ts
│   └── routes/
│       ├── analyze.ts
│       ├── report.ts
│       └── chat.ts
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── config.js
│   └── app.js
└── examples/
    └── sample-output.md
```

---

## Implementation Tasks

### Phase 1 — Foundation
- [x] `wrangler.jsonc` — Worker config with all bindings
- [x] `package.json` + `tsconfig.json` — project setup
- [x] `.gitignore`
- [x] `src/types.ts` — all shared TypeScript types
- [x] `src/config.ts` — constants (model names, supported tickers, etc.)

### Phase 2 — Utilities
- [x] `src/utils/ids.ts` — reportId generation
- [x] `src/utils/responses.ts` — JSON response helpers + CORS headers
- [x] `src/utils/validation.ts` — input validation (ticker, message)
- [x] `src/utils/time.ts` — ISO timestamp helpers

### Phase 3 — Core Library
- [x] `src/lib/ai.ts` — Workers AI wrapper with model fallback logic
- [x] `src/lib/companyContext.ts` — Alpha Vantage fetch + fallback context
- [x] `src/lib/memoBuilder.ts` — one function per memo section

### Phase 4 — Prompts
- [x] `src/prompts.ts` — all LLM prompt templates (overview, bull, bear, risks, conclusion, chat)

### Phase 5 — Durable Object
- [x] `src/durable/ReportStateDO.ts` — full DO class with state, sections, chat history

### Phase 6 — Workflow
- [x] `src/workflows/reportWorkflow.ts` — 8-step WorkflowEntrypoint

### Phase 7 — Routes + Entry Point
- [x] `src/routes/analyze.ts` — POST /api/analyze
- [x] `src/routes/report.ts` — GET /api/report/:id
- [x] `src/routes/chat.ts` — POST /api/chat/:id
- [x] `src/index.ts` — Worker entry point + route dispatch

### Phase 8 — Frontend
- [x] `frontend/config.js` — API_BASE_URL config
- [x] `frontend/styles.css` — clean, minimal styling
- [x] `frontend/index.html` — page structure
- [x] `frontend/app.js` — all UI logic (form, polling, memo render, chat)

### Phase 9 — Documentation
- [x] `README.md` — full project docs (setup, deploy, architecture, API)
- [x] `PROMPTS.md` — all prompt templates with purpose/context notes
- [x] `examples/sample-output.md` — example generated memo for NVDA

---

## Workflow Step Sequence

```
Step 1: Initialize report state in Durable Object
Step 2: Fetch company context from Alpha Vantage
Step 3: Generate Company Overview        → status: generating_overview
Step 4: Generate Bull Case               → status: generating_bull_case
Step 5: Generate Bear Case               → status: generating_bear_case
Step 6: Generate Key Risks               → status: generating_key_risks
Step 7: Generate Conclusion + What to Watch → status: generating_conclusion
Step 8: Synthesize Final Memo            → status: complete
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/analyze` | Create report, trigger Workflow |
| `GET` | `/api/report/:id` | Return full report state |
| `POST` | `/api/chat/:id` | Send follow-up question, get AI reply |

---

## Progress Log

| Date | Milestone |
|---|---|
| 2026-03-10 | Planning complete, PLAN.md created |
| 2026-03-11 | Full scaffold complete — all phases 1–9 done, repo pushed to GitHub |
