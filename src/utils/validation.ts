/** Valid ticker: 1–5 uppercase letters (NYSE/NASDAQ standard). */
const TICKER_RE = /^[A-Z]{1,5}$/;

export function validateTicker(raw: unknown): { valid: true; ticker: string } | { valid: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { valid: false, error: "ticker is required" };
  }
  const ticker = raw.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return { valid: false, error: "ticker must be 1–5 uppercase letters (e.g. NVDA)" };
  }
  return { valid: true, ticker };
}

export function validateMessage(raw: unknown): { valid: true; message: string } | { valid: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { valid: false, error: "message is required" };
  }
  const message = raw.trim();
  if (message.length > 1000) {
    return { valid: false, error: "message must be 1000 characters or fewer" };
  }
  return { valid: true, message };
}

export function validateFocusPrompt(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  return raw.trim().slice(0, 300); // cap at 300 chars
}
