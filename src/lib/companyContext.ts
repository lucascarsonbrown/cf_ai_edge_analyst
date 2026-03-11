import { ALPHA_VANTAGE_BASE } from "../config";
import type { CompanyContext } from "../types";

// ─── Alpha Vantage response shape (partial) ───────────────────────────────────

type AlphaVantageOverview = {
  Symbol?: string;
  Name?: string;
  Sector?: string;
  Industry?: string;
  Description?: string;
  MarketCapitalization?: string;
  PERatio?: string;
  "52WeekHigh"?: string;
  "52WeekLow"?: string;
  AnalystTargetPrice?: string;
  Note?: string; // present when rate-limited
};

// ─── Fallback context for unknown / rate-limited tickers ─────────────────────

function fallbackContext(ticker: string): CompanyContext {
  return {
    ticker,
    name: ticker,
    sector: "Unknown",
    industry: "Unknown",
    description: `${ticker} is a publicly traded company. Specific company data was unavailable at generation time. Analysis is based on general market reasoning.`,
    source: "fallback",
  };
}

// ─── Format large numbers into readable market cap strings ───────────────────

function formatMarketCap(raw: string | undefined): string | undefined {
  const n = Number(raw);
  if (!n || isNaN(n)) return undefined;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

// ─── Main fetch function ──────────────────────────────────────────────────────

/**
 * Fetches company overview data from Alpha Vantage.
 * Returns a fallback context object on any error or rate limit.
 */
export async function getCompanyContext(ticker: string, apiKey: string): Promise<CompanyContext> {
  const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;

  let data: AlphaVantageOverview;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "cf-ai-edge-analyst/0.1" },
      // Workers fetch timeout handled by platform (default 30s)
    });

    if (!res.ok) {
      console.warn(`Alpha Vantage returned HTTP ${res.status} for ${ticker}`);
      return fallbackContext(ticker);
    }

    data = (await res.json()) as AlphaVantageOverview;
  } catch (err) {
    console.warn(`Alpha Vantage fetch failed for ${ticker}:`, err);
    return fallbackContext(ticker);
  }

  // Rate-limited response contains a "Note" field and no Symbol
  if (data.Note || !data.Symbol || !data.Name) {
    console.warn(`Alpha Vantage rate limit or unknown ticker for ${ticker}`);
    return fallbackContext(ticker);
  }

  return {
    ticker: data.Symbol,
    name: data.Name,
    sector: data.Sector ?? "Unknown",
    industry: data.Industry ?? "Unknown",
    description: data.Description ?? `${data.Name} is a publicly traded company.`,
    marketCap: formatMarketCap(data.MarketCapitalization),
    peRatio: data.PERatio && data.PERatio !== "None" ? data.PERatio : undefined,
    weekHigh52: data["52WeekHigh"] && data["52WeekHigh"] !== "None" ? `$${data["52WeekHigh"]}` : undefined,
    weekLow52: data["52WeekLow"] && data["52WeekLow"] !== "None" ? `$${data["52WeekLow"]}` : undefined,
    analystTarget:
      data.AnalystTargetPrice && data.AnalystTargetPrice !== "None"
        ? `$${data.AnalystTargetPrice}`
        : undefined,
    source: "alphavantage",
  };
}
