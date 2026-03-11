# cf_ai_edge_analyst

An AI-powered equity research assistant built entirely on Cloudflare's developer platform. Enter a stock ticker, get a structured investment memo — generated step-by-step at the edge using Workers AI, orchestrated by Cloudflare Workflows, and persisted in Durable Objects.

---

## Why This Exists

Real investment research is a multi-step process: gather context, build a thesis, stress-test it, identify risks, synthesize a view. Most AI demos collapse this into a single LLM call. This project models that process correctly — each section of the memo is a distinct, durable workflow step, with state persisted between steps and visible to the user in real time.

It's also a demonstration of what "edge-native" AI applications look like: no centralized server, no external databases, no orchestration middleware — just Cloudflare primitives composing into a production-quality application.

---

## Features

- **Structured memo generation** — Company Overview, Bull Case, Bear Case, Key Risks, What to Watch, Bottom Line
- **Multi-step Cloudflare Workflow** — each memo section is a separate durable step with automatic retry and checkpoint
- **Live progress tracking** — frontend polls report state every 2 seconds, showing exactly which step is running
- **Durable Object state** — one DO instance per report; stores sections, status, and full chat history
- **Follow-up chat** — ask questions about the memo after generation; chat uses memo + history as context
- **Alpha Vantage integration** — real company data fetched from Alpha Vantage; graceful fallback for unknown tickers
- **Model resilience** — tries Llama 3.3 70B first, falls back to Llama 3.1 8B on timeout or error

---

## Cloudflare Products Used

| Product | Role |
|---|---|
| **Cloudflare Workers** | API layer — request routing, input validation, chat handling |
| **Workers AI** | LLM inference — Llama 3.3 70B (primary) / Llama 3.1 8B (fallback) |
| **Cloudflare Workflows** | Durable multi-step memo generation pipeline (8 steps) |
| **Durable Objects** | Per-report persistent state — sections, status, chat history |
| **Cloudflare Pages** | Static frontend hosting — HTML/CSS/JS |

---

## Architecture

```
┌─────────────────────────────────┐
│        Cloudflare Pages         │
│   (HTML / CSS / JS frontend)    │
└────────────┬────────────────────┘
             │ HTTP (polling + chat)
┌────────────▼────────────────────┐
│       Cloudflare Worker         │
│  POST /api/analyze              │
│  GET  /api/report/:id           │
│  POST /api/chat/:id             │
└────────┬──────────┬─────────────┘
         │          │
         │          │ read/write state
         │   ┌──────▼──────────────┐
         │   │   Durable Object    │
         │   │  (ReportStateDO)    │
         │   │  - report metadata  │
         │   │  - section outputs  │
         │   │  - status           │
         │   │  - chat history     │
         │   └─────────────────────┘
         │
         │ trigger
┌────────▼────────────────────────┐
│    Cloudflare Workflow          │
│    (ReportWorkflow)             │
│                                 │
│  Step 1: Initialize             │
│  Step 2: Fetch context (AV API) │
│  Step 3: Generate Overview   ──►│─── Workers AI (Llama 3.3 70B)
│  Step 4: Generate Bull Case  ──►│─── Workers AI
│  Step 5: Generate Bear Case  ──►│─── Workers AI
│  Step 6: Generate Key Risks  ──►│─── Workers AI
│  Step 7: Generate Conclusion ──►│─── Workers AI
│  Step 8: Synthesize Memo     ──►│─── Workers AI
│                                 │
│  (updates DO after each step)   │
└─────────────────────────────────┘
```

---

## Data Flow

**Memo generation:**
1. User submits ticker + optional focus note
2. Worker validates input, creates `reportId`, initializes Durable Object state
3. Worker triggers `ReportWorkflow` and returns `{ reportId }`
4. Frontend polls `GET /api/report/:id` every 2 seconds
5. Workflow runs 8 steps, updating DO status and sections after each
6. Frontend renders sections as they arrive; shows full memo on `complete`

**Follow-up chat:**
1. User submits question via chat panel
2. Worker loads report state from DO
3. Worker builds LLM context: memo + chat history + new question
4. Workers AI generates reply
5. Both sides of the exchange are appended to DO chat history
6. Frontend displays response

---

## Project Structure

```
cf_ai_edge_analyst/
├── README.md
├── PROMPTS.md              # All LLM prompt templates + design notes
├── PLAN.md                 # Implementation plan and progress tracker
├── package.json
├── tsconfig.json
├── wrangler.jsonc          # Worker, DO, Workflow, AI bindings
│
├── src/                    # Cloudflare Worker (TypeScript)
│   ├── index.ts            # Entry point + route dispatch
│   ├── types.ts            # All shared TypeScript types
│   ├── prompts.ts          # All LLM prompt templates
│   ├── config.ts           # Model names, constants
│   ├── utils/
│   │   ├── ids.ts          # reportId generation
│   │   ├── responses.ts    # JSON + CORS helpers
│   │   ├── validation.ts   # Input validation
│   │   └── time.ts         # ISO timestamp
│   ├── lib/
│   │   ├── ai.ts           # Workers AI wrapper + model fallback
│   │   ├── companyContext.ts  # Alpha Vantage fetch + fallback
│   │   └── memoBuilder.ts  # One function per memo section
│   ├── workflows/
│   │   └── reportWorkflow.ts  # WorkflowEntrypoint (8 steps)
│   ├── durable/
│   │   └── ReportStateDO.ts   # Durable Object — state + chat
│   └── routes/
│       ├── analyze.ts      # POST /api/analyze
│       ├── report.ts       # GET /api/report/:id
│       └── chat.ts         # POST /api/chat/:id
│
├── frontend/               # Deployed to Cloudflare Pages
│   ├── index.html
│   ├── styles.css
│   ├── config.js           # API_BASE_URL — update before deploy
│   └── app.js
│
└── examples/
    └── sample-output.md    # Example NVDA memo
```

---

## API Reference

### `POST /api/analyze`

Start a new report. Returns a `reportId` to poll with.

**Request:**
```json
{
  "ticker": "NVDA",
  "focusPrompt": "Focus on AI infrastructure demand and valuation risk"
}
```

**Response `202`:**
```json
{
  "reportId": "rpt_3a9f1c04b82e",
  "status": "queued"
}
```

---

### `GET /api/report/:id`

Get current report state. Poll this endpoint until `status === "complete"`.

**Response `200`:**
```json
{
  "id": "rpt_3a9f1c04b82e",
  "ticker": "NVDA",
  "focusPrompt": "...",
  "status": "generating_bull_case",
  "sections": {
    "overview": "...",
    "bullCase": "..."
  },
  "chatHistory": [],
  "createdAt": "2025-03-10T12:00:00.000Z",
  "updatedAt": "2025-03-10T12:00:45.000Z"
}
```

---

### `POST /api/chat/:id`

Send a follow-up question. Report must be `complete`.

**Request:**
```json
{
  "message": "What is the biggest risk to the bull case?"
}
```

**Response `200`:**
```json
{
  "reply": "The biggest risk to the bull case is...",
  "chatHistory": [...]
}
```

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account on the **Workers Paid plan** (required for Durable Objects and Workflows)
- An [Alpha Vantage API key](https://www.alphavantage.co/support/#api-key) (free tier)

### 1. Clone and install

```bash
git clone https://github.com/lucascarsonbrown/cf_ai_edge_analyst.git
cd cf_ai_edge_analyst
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Set your Alpha Vantage API key

```bash
wrangler secret put ALPHA_VANTAGE_API_KEY
# Paste your key when prompted
```

### 4. Run locally

```bash
wrangler dev
```

> Note: Durable Objects and Workflows run locally via Wrangler's local simulation. The first run may take a moment to initialize.

Open `frontend/index.html` in a browser. The default `config.js` points to `http://localhost:8787`.

---

## Deployment

### Deploy the Worker

```bash
wrangler deploy
```

Copy the deployed Worker URL (e.g. `https://cf-ai-edge-analyst.<your-subdomain>.workers.dev`).

### Deploy the frontend to Pages

1. Update `frontend/config.js`:
```js
const CONFIG = {
  API_BASE_URL: "https://cf-ai-edge-analyst.<your-subdomain>.workers.dev",
  POLL_INTERVAL_MS: 2000,
};
```

2. Deploy the `frontend/` directory to Cloudflare Pages:
```bash
# Via Wrangler
npx wrangler pages deploy frontend --project-name cf-ai-edge-analyst

# Or connect the GitHub repo to Cloudflare Pages in the dashboard
# and set the build output directory to "frontend"
```

---

## Report Status Values

| Status | Description |
|---|---|
| `queued` | Report created, workflow not yet started |
| `initializing` | Workflow started, DO state initialized |
| `fetching_context` | Fetching company data from Alpha Vantage |
| `generating_overview` | Writing Company Overview section |
| `generating_bull_case` | Writing Bull Case section |
| `generating_bear_case` | Writing Bear Case section |
| `generating_key_risks` | Writing Key Risks section |
| `generating_conclusion` | Writing What to Watch + Bottom Line |
| `synthesizing` | Assembling final memo |
| `complete` | Memo ready |
| `error` | Generation failed (partial sections preserved) |

---

## Example Use Cases

- **Earnings preview:** Enter `NVDA` with focus "Q4 earnings risk and guidance" before NVIDIA's earnings
- **Sector research:** Enter `NET` with focus "competitive dynamics in SASE and zero trust"
- **Valuation check:** Enter `PLTR` with focus "growth rate sustainability vs. current multiple"
- **Unknown ticker:** Enter any ticker — the system gracefully falls back if Alpha Vantage doesn't have data

---

## Notes

- The free Alpha Vantage tier allows 25 requests/day and 5/minute. For a demo, this is sufficient. The app degrades gracefully to fallback context on rate limits.
- Memo generation takes approximately 60–120 seconds depending on model load and the number of steps.
- Durable Objects persist report state indefinitely. Each `reportId` maps to a unique DO instance.
- All prompts are documented in `PROMPTS.md`.
