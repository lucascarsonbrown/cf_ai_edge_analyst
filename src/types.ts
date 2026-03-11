// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

// ─── Report sections ─────────────────────────────────────────────────────────

export type ReportSections = {
  overview?: string;
  bullCase?: string;
  bearCase?: string;
  keyRisks?: string;
  whatToWatch?: string;
  bottomLine?: string;
  finalMemo?: string;
};

// ─── Report status ───────────────────────────────────────────────────────────

export type ReportStatus =
  | "queued"
  | "initializing"
  | "fetching_context"
  | "generating_overview"
  | "generating_bull_case"
  | "generating_bear_case"
  | "generating_key_risks"
  | "generating_conclusion"
  | "synthesizing"
  | "complete"
  | "error";

// ─── Report state (canonical shape stored in Durable Object) ─────────────────

export type ReportState = {
  id: string;
  ticker: string;
  focusPrompt?: string;
  status: ReportStatus;
  sections: ReportSections;
  chatHistory: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  error?: string;
};

// ─── Company context (built from Alpha Vantage or fallback) ──────────────────

export type CompanyContext = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  marketCap?: string;
  peRatio?: string;
  weekHigh52?: string;
  weekLow52?: string;
  analystTarget?: string;
  source: "alphavantage" | "fallback";
};

// ─── API request / response shapes ───────────────────────────────────────────

export type AnalyzeRequest = {
  ticker: string;
  focusPrompt?: string;
};

export type AnalyzeResponse = {
  reportId: string;
  status: ReportStatus;
};

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  reply: string;
  chatHistory: ChatMessage[];
};

export type ErrorResponse = {
  error: string;
  code: string;
};

// ─── Workflow params ──────────────────────────────────────────────────────────

export type WorkflowParams = {
  reportId: string;
  ticker: string;
  focusPrompt?: string;
};

// ─── Worker env bindings ──────────────────────────────────────────────────────

export interface Env {
  AI: Ai;
  REPORT_STATE: DurableObjectNamespace;
  REPORT_WORKFLOW: Workflow;
  ALPHA_VANTAGE_API_KEY: string;
}
