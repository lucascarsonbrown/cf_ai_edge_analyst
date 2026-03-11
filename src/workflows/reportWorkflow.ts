import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { getCompanyContext } from "../lib/companyContext";
import {
  generateOverview,
  generateBullCase,
  generateBearCase,
  generateKeyRisks,
  generateConclusion,
  synthesizeFinalMemo,
} from "../lib/memoBuilder";
import type { Env, WorkflowParams, ReportSections } from "../types";

/**
 * ReportWorkflow — multi-step memo generation pipeline.
 *
 * Each step.do() call is a durable checkpoint. If the workflow is interrupted,
 * Cloudflare will resume from the last completed step automatically.
 *
 * Steps:
 *  1. Initialize report state
 *  2. Fetch company context from Alpha Vantage
 *  3. Generate Company Overview
 *  4. Generate Bull Case
 *  5. Generate Bear Case
 *  6. Generate Key Risks
 *  7. Generate Conclusion (What to Watch + Bottom Line)
 *  8. Synthesize final memo
 */
export class ReportWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep): Promise<void> {
    const { reportId, ticker, focusPrompt } = event.payload;

    // Helper: get the DO stub for this report
    const getStub = () => {
      const id = this.env.REPORT_STATE.idFromName(reportId);
      return this.env.REPORT_STATE.get(id);
    };

    const setStatus = async (status: string) => {
      const stub = getStub();
      await stub.fetch("https://do/update-status", {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    };

    const setSection = async (key: keyof ReportSections, value: string) => {
      const stub = getStub();
      await stub.fetch("https://do/update-section", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
    };

    const setError = async (error: string) => {
      const stub = getStub();
      await stub.fetch("https://do/set-error", {
        method: "POST",
        body: JSON.stringify({ error }),
      });
    };

    try {
      // ── Step 1: Mark initializing ─────────────────────────────────────────
      await step.do("initialize", async () => {
        await setStatus("initializing");
      });

      // ── Step 2: Fetch company context ─────────────────────────────────────
      const ctx = await step.do("fetch-context", async () => {
        await setStatus("fetching_context");
        const context = await getCompanyContext(
          ticker,
          this.env.ALPHA_VANTAGE_API_KEY,
          this.env.FINNHUB_API_KEY,
          this.env.FMP_API_KEY
        );
        // Persist which data sources responded so the frontend can warn the user
        const stub = getStub();
        await stub.fetch("https://do/set-datasources", {
          method: "POST",
          body: JSON.stringify({ dataSources: context.dataSources }),
        });
        return context;
      });

      // ── Step 3: Generate overview ─────────────────────────────────────────
      const overview = await step.do("generate-overview", async () => {
        await setStatus("generating_overview");
        const text = await generateOverview(this.env, ctx, focusPrompt);
        await setSection("overview", text);
        return text;
      });

      // ── Step 4: Generate bull case ────────────────────────────────────────
      const bullCase = await step.do("generate-bull-case", async () => {
        await setStatus("generating_bull_case");
        const text = await generateBullCase(this.env, ctx, overview, focusPrompt);
        await setSection("bullCase", text);
        return text;
      });

      // ── Step 5: Generate bear case ────────────────────────────────────────
      const bearCase = await step.do("generate-bear-case", async () => {
        await setStatus("generating_bear_case");
        const text = await generateBearCase(this.env, ctx, overview, focusPrompt);
        await setSection("bearCase", text);
        return text;
      });

      // ── Step 6: Generate key risks ────────────────────────────────────────
      const keyRisks = await step.do("generate-key-risks", async () => {
        await setStatus("generating_key_risks");
        const text = await generateKeyRisks(this.env, ctx, bullCase, bearCase, focusPrompt);
        await setSection("keyRisks", text);
        return text;
      });

      // ── Step 7: Generate conclusion ───────────────────────────────────────
      const { whatToWatch, bottomLine } = await step.do("generate-conclusion", async () => {
        await setStatus("generating_conclusion");
        const result = await generateConclusion(
          this.env,
          ctx,
          overview,
          bullCase,
          bearCase,
          keyRisks,
          focusPrompt
        );
        await setSection("whatToWatch", result.whatToWatch);
        await setSection("bottomLine", result.bottomLine);
        return result;
      });

      // ── Step 8: Synthesize final memo ─────────────────────────────────────
      await step.do("synthesize-memo", async () => {
        await setStatus("synthesizing");
        const finalMemo = await synthesizeFinalMemo(
          this.env,
          ctx,
          { overview, bullCase, bearCase, keyRisks, whatToWatch, bottomLine },
          focusPrompt
        );
        await setSection("finalMemo", finalMemo);
        await setStatus("complete");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ReportWorkflow failed for ${reportId}:`, message);
      await setError(message).catch(() => {});
    }
  }
}
