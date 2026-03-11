import { handleAnalyze } from "./routes/analyze";
import { handleReport } from "./routes/report";
import { handleChat } from "./routes/chat";
import { corsPreflightResponse, errorResponse } from "./utils/responses";
import { ReportStateDO } from "./durable/ReportStateDO";
import { ReportWorkflow } from "./workflows/reportWorkflow";
import type { Env } from "./types";

// Augment Env with the static assets binding added in wrangler.jsonc
declare module "./types" {
  interface Env {
    ASSETS: Fetcher;
  }
}

// Re-export Durable Object and Workflow classes so Cloudflare can bind them
export { ReportStateDO, ReportWorkflow };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return corsPreflightResponse();
    }

    const url = new URL(request.url);
    const { pathname } = url;

    // POST /api/analyze
    if (pathname === "/api/analyze" && request.method === "POST") {
      return handleAnalyze(request, env);
    }

    // GET /api/report/:id
    const reportMatch = pathname.match(/^\/api\/report\/([^/]+)$/);
    if (reportMatch && request.method === "GET") {
      return handleReport(reportMatch[1], env);
    }

    // POST /api/chat/:id
    const chatMatch = pathname.match(/^\/api\/chat\/([^/]+)$/);
    if (chatMatch && request.method === "POST") {
      return handleChat(chatMatch[1], request, env);
    }

    // Health check
    if (pathname === "/api/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fall through to static frontend assets (index.html, styles.css, app.js)
    return env.ASSETS.fetch(request);
  },
};
