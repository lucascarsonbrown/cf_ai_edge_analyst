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
  // Populated after context fetch — tells the frontend which data sources were available
  dataSources?: string[];
};

// ─── Company context sub-types ────────────────────────────────────────────────

export type AnalystRatings = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
};

export type PriceTarget = {
  mean: string;
  high: string;
  low: string;
  median: string;
};

export type NewsItem = {
  headline: string;
  source: string;
  datetime: string;
};

export type EarningsSurprise = {
  period: string;       // e.g. "2024-10-27"
  actual: number;
  estimate: number;
  surprisePercent: number;
};

export type RecentFiling = {
  type: string;         // "10-K", "10-Q", "8-K"
  date: string;
};

// ─── Combined company context ─────────────────────────────────────────────────

export type CompanyContext = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  description: string;

  // ── Alpha Vantage ──────────────────────────────────────────────────────────
  marketCap?: string;
  peRatioAV?: string;
  weekHigh52?: string;
  weekLow52?: string;
  analystTargetAV?: string;

  // ── Finnhub ────────────────────────────────────────────────────────────────
  analystRatings?: AnalystRatings;
  priceTarget?: PriceTarget;
  recentNews?: NewsItem[];
  earningsSurprises?: EarningsSurprise[];

  // ── Financial Modeling Prep ────────────────────────────────────────────────
  revenueTTM?: string;
  netIncomeTTM?: string;
  epsTTM?: string;
  revenueGrowthYoY?: string;
  netMargin?: string;
  evToEbitda?: string;
  priceToSales?: string;
  freeCashFlowTTM?: string;
  debtToEquity?: string;
  returnOnEquity?: string;

  // ── SEC EDGAR ──────────────────────────────────────────────────────────────
  recentFilings?: RecentFiling[];

  // ── Meta ──────────────────────────────────────────────────────────────────
  dataSources: string[];   // which sources returned data successfully
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
  ASSETS: Fetcher;
  REPORT_STATE: DurableObjectNamespace;
  REPORT_WORKFLOW: Workflow;
  ALPHA_VANTAGE_API_KEY: string;
  FINNHUB_API_KEY: string;
  FMP_API_KEY: string;
}
