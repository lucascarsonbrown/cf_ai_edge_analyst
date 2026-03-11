// ─── LLM models ───────────────────────────────────────────────────────────────

export const PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;
export const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct" as const;

// Max tokens per section generation call
export const MAX_TOKENS_SECTION = 600;
// Max tokens for final memo synthesis
export const MAX_TOKENS_MEMO = 1200;
// Max tokens for chat reply
export const MAX_TOKENS_CHAT = 500;

// ─── Alpha Vantage ────────────────────────────────────────────────────────────

export const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

// ─── Supported tickers (used only for display hints, not for gating) ─────────

export const FEATURED_TICKERS = ["NVDA", "PLTR", "NET", "AAPL", "MSFT", "AMZN"] as const;

// ─── CORS ─────────────────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;
