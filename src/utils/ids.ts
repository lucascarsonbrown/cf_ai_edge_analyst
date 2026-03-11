/**
 * Generates a short unique report ID using the Web Crypto API available in Workers.
 * Format: "rpt_<12 hex chars>"  e.g. "rpt_3a9f1c04b82e"
 */
export function generateReportId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `rpt_${hex}`;
}
