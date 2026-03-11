import {
  ALPHA_VANTAGE_BASE,
  FINNHUB_BASE,
  FMP_BASE,
  EDGAR_TICKERS_URL,
  EDGAR_SUBMISSIONS_BASE,
} from "../config";
import type {
  CompanyContext,
  AnalystRatings,
  PriceTarget,
  NewsItem,
  EarningsSurprise,
  RecentFiling,
} from "../types";

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function safeFetch<T>(url: string, label: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "cf-ai-edge-analyst/0.1 (research demo)" },
    });
    if (!res.ok) {
      console.warn(`[${label}] HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[${label}] fetch failed:`, err);
    return null;
  }
}

// ─── Number formatters ────────────────────────────────────────────────────────

function fmtLargeNum(n: number | undefined): string | undefined {
  if (n === undefined || n === null || isNaN(n)) return undefined;
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | undefined): string | undefined {
  if (n === undefined || n === null || isNaN(n)) return undefined;
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | undefined, decimals = 2): string | undefined {
  if (n === undefined || n === null || isNaN(n)) return undefined;
  return n.toFixed(decimals);
}

function avVal(v: string | undefined): string | undefined {
  return v && v !== "None" && v !== "-" ? v : undefined;
}

// ─── Source: Alpha Vantage ────────────────────────────────────────────────────

type AVOverview = {
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
  Note?: string;
};

type AVResult = {
  name: string;
  sector: string;
  industry: string;
  description: string;
  marketCap?: string;
  peRatioAV?: string;
  weekHigh52?: string;
  weekLow52?: string;
  analystTargetAV?: string;
};

async function fetchAlphaVantage(ticker: string, apiKey: string): Promise<AVResult | null> {
  const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const data = await safeFetch<AVOverview>(url, "AlphaVantage");
  if (!data || data.Note || !data.Symbol || !data.Name) return null;

  const mcap = Number(data.MarketCapitalization);
  return {
    name: data.Name,
    sector: data.Sector ?? "Unknown",
    industry: data.Industry ?? "Unknown",
    description: data.Description ?? "",
    marketCap: fmtLargeNum(isNaN(mcap) ? undefined : mcap),
    peRatioAV: avVal(data.PERatio),
    weekHigh52: avVal(data["52WeekHigh"]) ? `$${data["52WeekHigh"]}` : undefined,
    weekLow52: avVal(data["52WeekLow"]) ? `$${data["52WeekLow"]}` : undefined,
    analystTargetAV: avVal(data.AnalystTargetPrice) ? `$${data.AnalystTargetPrice}` : undefined,
  };
}

// ─── Source: Finnhub ──────────────────────────────────────────────────────────

type FHRecommendation = { buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; period: string };
type FHPriceTarget = { targetHigh: number; targetLow: number; targetMean: number; targetMedian: number };
type FHNews = { headline: string; source: string; datetime: number };
type FHEarnings = { period: string; actual: number; estimate: number; surprisePercent: number };

type FinnhubResult = {
  analystRatings?: AnalystRatings;
  priceTarget?: PriceTarget;
  recentNews?: NewsItem[];
  earningsSurprises?: EarningsSurprise[];
};

async function fetchFinnhub(ticker: string, apiKey: string): Promise<FinnhubResult | null> {
  const t = encodeURIComponent(ticker);
  const key = `&token=${apiKey}`;

  // Date range for news: last 30 days
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [recData, ptData, newsData, earnData] = await Promise.all([
    safeFetch<FHRecommendation[]>(`${FINNHUB_BASE}/stock/recommendation?symbol=${t}${key}`, "Finnhub/rec"),
    safeFetch<FHPriceTarget>(`${FINNHUB_BASE}/stock/price-target?symbol=${t}${key}`, "Finnhub/pt"),
    safeFetch<FHNews[]>(`${FINNHUB_BASE}/company-news?symbol=${t}&from=${fromDate}&to=${toDate}${key}`, "Finnhub/news"),
    safeFetch<FHEarnings[]>(`${FINNHUB_BASE}/stock/earnings?symbol=${t}&limit=4${key}`, "Finnhub/earn"),
  ]);

  const result: FinnhubResult = {};

  // Analyst ratings — take the most recent period
  if (Array.isArray(recData) && recData.length > 0) {
    const r = recData[0];
    result.analystRatings = {
      strongBuy: r.strongBuy,
      buy: r.buy,
      hold: r.hold,
      sell: r.sell,
      strongSell: r.strongSell,
      period: r.period,
    };
  }

  // Price target
  if (ptData && ptData.targetMean) {
    result.priceTarget = {
      mean: `$${ptData.targetMean.toFixed(2)}`,
      high: `$${ptData.targetHigh.toFixed(2)}`,
      low: `$${ptData.targetLow.toFixed(2)}`,
      median: `$${ptData.targetMedian.toFixed(2)}`,
    };
  }

  // News — top 5 most recent
  if (Array.isArray(newsData) && newsData.length > 0) {
    result.recentNews = newsData.slice(0, 5).map((n) => ({
      headline: n.headline,
      source: n.source,
      datetime: new Date(n.datetime * 1000).toISOString().slice(0, 10),
    }));
  }

  // Earnings surprises — last 4 quarters
  if (Array.isArray(earnData) && earnData.length > 0) {
    result.earningsSurprises = earnData.slice(0, 4).map((e) => ({
      period: e.period,
      actual: e.actual,
      estimate: e.estimate,
      surprisePercent: e.surprisePercent,
    }));
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

// ─── Source: Financial Modeling Prep ─────────────────────────────────────────

type FMPKeyMetrics = {
  peRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  enterpriseValueOverEBITDATTM?: number;
  freeCashFlowPerShareTTM?: number;
  netProfitMarginTTM?: number;
  debtToEquityTTM?: number;
  roeTTM?: number;
  marketCapTTM?: number;
};

type FMPIncomeStatement = {
  revenue?: number;
  netIncome?: number;
  epsdiluted?: number;
  date?: string;
};

type FMPResult = {
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
};

async function fetchFMP(ticker: string, apiKey: string): Promise<FMPResult | null> {
  const t = encodeURIComponent(ticker);
  const key = `apikey=${apiKey}`;

  const [metricsData, incomeData] = await Promise.all([
    safeFetch<FMPKeyMetrics[]>(`${FMP_BASE}/key-metrics-ttm/${t}?${key}`, "FMP/metrics"),
    safeFetch<FMPIncomeStatement[]>(`${FMP_BASE}/income-statement/${t}?limit=2&${key}`, "FMP/income"),
  ]);

  const result: FMPResult = {};

  if (Array.isArray(metricsData) && metricsData.length > 0) {
    const m = metricsData[0];
    result.netMargin = fmtPct(m.netProfitMarginTTM);
    result.evToEbitda = fmtNum(m.enterpriseValueOverEBITDATTM);
    result.priceToSales = fmtNum(m.priceToSalesRatioTTM);
    result.debtToEquity = fmtNum(m.debtToEquityTTM);
    result.returnOnEquity = fmtPct(m.roeTTM);
  }

  if (Array.isArray(incomeData) && incomeData.length > 0) {
    const latest = incomeData[0];
    result.revenueTTM = fmtLargeNum(latest.revenue);
    result.netIncomeTTM = fmtLargeNum(latest.netIncome);
    result.epsTTM = latest.epsdiluted !== undefined ? `$${latest.epsdiluted.toFixed(2)}` : undefined;

    // YoY revenue growth if we have two years
    if (incomeData.length >= 2 && incomeData[1].revenue && latest.revenue) {
      const growth = (latest.revenue - incomeData[1].revenue) / Math.abs(incomeData[1].revenue);
      result.revenueGrowthYoY = `${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}%`;
    }
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

// ─── Source: SEC EDGAR ────────────────────────────────────────────────────────

type EdgarTickerEntry = { cik_str: number; ticker: string; title: string };
type EdgarSubmissions = {
  filings?: {
    recent?: {
      form: string[];
      filingDate: string[];
    };
  };
};

async function fetchEdgar(ticker: string): Promise<RecentFiling[] | null> {
  // Step 1: Resolve ticker → CIK
  const tickerMap = await safeFetch<Record<string, EdgarTickerEntry>>(
    EDGAR_TICKERS_URL,
    "EDGAR/tickers"
  );
  if (!tickerMap) return null;

  const entry = Object.values(tickerMap).find(
    (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
  );
  if (!entry) return null;

  const cik = String(entry.cik_str).padStart(10, "0");

  // Step 2: Fetch submission history
  const submissions = await safeFetch<EdgarSubmissions>(
    `${EDGAR_SUBMISSIONS_BASE}/CIK${cik}.json`,
    "EDGAR/submissions"
  );
  if (!submissions?.filings?.recent) return null;

  const { form, filingDate } = submissions.filings.recent;
  const relevant = ["10-K", "10-Q", "8-K"];
  const filings: RecentFiling[] = [];

  for (let i = 0; i < form.length && filings.length < 6; i++) {
    if (relevant.includes(form[i])) {
      filings.push({ type: form[i], date: filingDate[i] });
    }
  }

  return filings.length > 0 ? filings : null;
}

// ─── Fallback context ─────────────────────────────────────────────────────────

function fallbackContext(ticker: string): CompanyContext {
  return {
    ticker,
    name: ticker,
    sector: "Unknown",
    industry: "Unknown",
    description: `${ticker} is a publicly traded company. Specific company data was unavailable at generation time. Analysis is based on general market reasoning.`,
    dataSources: [],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches company data from all four sources in parallel.
 * Each source fails independently — partial context is always returned.
 */
export async function getCompanyContext(
  ticker: string,
  alphaVantageKey: string,
  finnhubKey: string,
  fmpKey: string
): Promise<CompanyContext> {
  const [avResult, fhResult, fmpResult, edgarResult] = await Promise.allSettled([
    fetchAlphaVantage(ticker, alphaVantageKey),
    fetchFinnhub(ticker, finnhubKey),
    fetchFMP(ticker, fmpKey),
    fetchEdgar(ticker),
  ]);

  const av = avResult.status === "fulfilled" ? avResult.value : null;
  const fh = fhResult.status === "fulfilled" ? fhResult.value : null;
  const fmp = fmpResult.status === "fulfilled" ? fmpResult.value : null;
  const edgar = edgarResult.status === "fulfilled" ? edgarResult.value : null;

  // If no source returned a company name, use fallback
  if (!av && !fh && !fmp) return fallbackContext(ticker);

  const dataSources: string[] = [];
  if (av) dataSources.push("Alpha Vantage");
  if (fh) dataSources.push("Finnhub");
  if (fmp) dataSources.push("Financial Modeling Prep");
  if (edgar) dataSources.push("SEC EDGAR");

  return {
    ticker,
    name: av?.name ?? ticker,
    sector: av?.sector ?? "Unknown",
    industry: av?.industry ?? "Unknown",
    description: av?.description ?? `${ticker} is a publicly traded company.`,

    // Alpha Vantage
    marketCap: av?.marketCap,
    peRatioAV: av?.peRatioAV,
    weekHigh52: av?.weekHigh52,
    weekLow52: av?.weekLow52,
    analystTargetAV: av?.analystTargetAV,

    // Finnhub
    analystRatings: fh?.analystRatings,
    priceTarget: fh?.priceTarget,
    recentNews: fh?.recentNews,
    earningsSurprises: fh?.earningsSurprises,

    // FMP
    revenueTTM: fmp?.revenueTTM,
    netIncomeTTM: fmp?.netIncomeTTM,
    epsTTM: fmp?.epsTTM,
    revenueGrowthYoY: fmp?.revenueGrowthYoY,
    netMargin: fmp?.netMargin,
    evToEbitda: fmp?.evToEbitda,
    priceToSales: fmp?.priceToSales,
    freeCashFlowTTM: fmp?.freeCashFlowTTM,
    debtToEquity: fmp?.debtToEquity,
    returnOnEquity: fmp?.returnOnEquity,

    // EDGAR
    recentFilings: edgar ?? undefined,

    dataSources,
  };
}

// ─── Context formatter for prompts ────────────────────────────────────────────

/**
 * Formats a CompanyContext into a structured text block for LLM prompts.
 * Omits fields that are undefined to avoid cluttering the prompt with "N/A".
 */
export function formatContextForPrompt(ctx: CompanyContext): string {
  const lines: string[] = [];

  lines.push(`COMPANY: ${ctx.name} (${ctx.ticker})`);
  lines.push(`Sector: ${ctx.sector} | Industry: ${ctx.industry}`);
  lines.push("");

  // ── Valuation & Price ──────────────────────────────────────────────────────
  const valuation: string[] = [];
  if (ctx.marketCap) valuation.push(`Market Cap: ${ctx.marketCap}`);
  if (ctx.peRatioAV) valuation.push(`P/E: ${ctx.peRatioAV}x`);
  if (ctx.evToEbitda) valuation.push(`EV/EBITDA: ${ctx.evToEbitda}x`);
  if (ctx.priceToSales) valuation.push(`P/S: ${ctx.priceToSales}x`);
  if (ctx.weekHigh52 && ctx.weekLow52) valuation.push(`52-Week Range: ${ctx.weekLow52} – ${ctx.weekHigh52}`);
  if (valuation.length > 0) {
    lines.push("VALUATION:");
    lines.push(`  ${valuation.join(" | ")}`);
    lines.push("");
  }

  // ── Financials ─────────────────────────────────────────────────────────────
  const financials: string[] = [];
  if (ctx.revenueTTM) financials.push(`Revenue (TTM): ${ctx.revenueTTM}`);
  if (ctx.netIncomeTTM) financials.push(`Net Income (TTM): ${ctx.netIncomeTTM}`);
  if (ctx.epsTTM) financials.push(`EPS (diluted): ${ctx.epsTTM}`);
  if (ctx.freeCashFlowTTM) financials.push(`FCF: ${ctx.freeCashFlowTTM}`);
  if (ctx.revenueGrowthYoY) financials.push(`Revenue Growth YoY: ${ctx.revenueGrowthYoY}`);
  if (ctx.netMargin) financials.push(`Net Margin: ${ctx.netMargin}`);
  if (ctx.returnOnEquity) financials.push(`ROE: ${ctx.returnOnEquity}`);
  if (ctx.debtToEquity) financials.push(`Debt/Equity: ${ctx.debtToEquity}x`);
  if (financials.length > 0) {
    lines.push("FINANCIALS:");
    financials.forEach((f) => lines.push(`  ${f}`));
    lines.push("");
  }

  // ── Analyst Consensus ─────────────────────────────────────────────────────
  if (ctx.analystRatings || ctx.priceTarget || ctx.analystTargetAV) {
    lines.push("ANALYST CONSENSUS:");
    if (ctx.analystRatings) {
      const r = ctx.analystRatings;
      const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
      lines.push(
        `  Ratings (${r.period}): Strong Buy: ${r.strongBuy} | Buy: ${r.buy} | Hold: ${r.hold} | Sell: ${r.sell} | Strong Sell: ${r.strongSell} (${total} analysts)`
      );
    }
    if (ctx.priceTarget) {
      const pt = ctx.priceTarget;
      lines.push(`  Price Target: Mean ${pt.mean} | Median ${pt.median} | High ${pt.high} | Low ${pt.low}`);
    } else if (ctx.analystTargetAV) {
      lines.push(`  Analyst Target (Alpha Vantage): ${ctx.analystTargetAV}`);
    }
    lines.push("");
  }

  // ── Earnings Surprises ────────────────────────────────────────────────────
  if (ctx.earningsSurprises && ctx.earningsSurprises.length > 0) {
    lines.push("EARNINGS HISTORY (last 4 quarters):");
    ctx.earningsSurprises.forEach((e) => {
      const dir = e.surprisePercent >= 0 ? "beat" : "missed";
      const sign = e.surprisePercent >= 0 ? "+" : "";
      lines.push(
        `  ${e.period}: EPS actual $${e.actual.toFixed(2)} vs est $${e.estimate.toFixed(2)} (${dir} by ${sign}${e.surprisePercent.toFixed(1)}%)`
      );
    });
    lines.push("");
  }

  // ── Recent News ───────────────────────────────────────────────────────────
  if (ctx.recentNews && ctx.recentNews.length > 0) {
    lines.push("RECENT NEWS (last 30 days):");
    ctx.recentNews.forEach((n) => {
      lines.push(`  [${n.datetime}] ${n.headline} (${n.source})`);
    });
    lines.push("");
  }

  // ── SEC Filings ───────────────────────────────────────────────────────────
  if (ctx.recentFilings && ctx.recentFilings.length > 0) {
    lines.push("RECENT SEC FILINGS:");
    ctx.recentFilings.forEach((f) => {
      lines.push(`  ${f.type} filed ${f.date}`);
    });
    lines.push("");
  }

  // ── Company Description ───────────────────────────────────────────────────
  lines.push("COMPANY DESCRIPTION:");
  lines.push(`  ${ctx.description}`);
  lines.push("");

  lines.push(`Data sourced from: ${ctx.dataSources.length > 0 ? ctx.dataSources.join(", ") : "fallback only"}`);

  return lines.join("\n");
}
