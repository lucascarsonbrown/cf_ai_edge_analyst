import { now } from "../utils/time";
import type { ReportState, ReportStatus, ReportSections, ChatMessage } from "../types";

/**
 * ReportStateDO — one Durable Object instance per report.
 *
 * Responsibilities:
 *  - Store and serve canonical report state
 *  - Accept granular updates from the Workflow (status, individual sections)
 *  - Store chat history for follow-up Q&A
 *
 * All state is persisted via the DO Storage API so it survives eviction.
 */
export class ReportStateDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop();

    switch (action) {
      case "init":
        return this.handleInit(request);
      case "get":
        return this.handleGet();
      case "update-status":
        return this.handleUpdateStatus(request);
      case "update-section":
        return this.handleUpdateSection(request);
      case "append-chat":
        return this.handleAppendChat(request);
      case "set-error":
        return this.handleSetError(request);
      case "set-datasources":
        return this.handleSetDataSources(request);
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      id: string;
      ticker: string;
      focusPrompt?: string;
    };

    const report: ReportState = {
      id: body.id,
      ticker: body.ticker,
      focusPrompt: body.focusPrompt,
      status: "queued",
      sections: {},
      chatHistory: [],
      createdAt: now(),
      updatedAt: now(),
    };

    await this.state.storage.put("report", report);
    return this.jsonResponse(report);
  }

  private async handleGet(): Promise<Response> {
    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });
    return this.jsonResponse(report);
  }

  private async handleUpdateStatus(request: Request): Promise<Response> {
    const { status } = (await request.json()) as { status: ReportStatus };
    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });

    report.status = status;
    report.updatedAt = now();
    await this.state.storage.put("report", report);
    return this.jsonResponse({ ok: true });
  }

  private async handleUpdateSection(request: Request): Promise<Response> {
    const { key, value } = (await request.json()) as {
      key: keyof ReportSections;
      value: string;
    };

    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });

    report.sections[key] = value;
    report.updatedAt = now();
    await this.state.storage.put("report", report);
    return this.jsonResponse({ ok: true });
  }

  private async handleAppendChat(request: Request): Promise<Response> {
    const messages = (await request.json()) as ChatMessage[];
    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });

    report.chatHistory.push(...messages);
    report.updatedAt = now();
    await this.state.storage.put("report", report);
    return this.jsonResponse({ ok: true, chatHistory: report.chatHistory });
  }

  private async handleSetError(request: Request): Promise<Response> {
    const { error } = (await request.json()) as { error: string };
    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });

    report.status = "error";
    report.error = error;
    report.updatedAt = now();
    await this.state.storage.put("report", report);
    return this.jsonResponse({ ok: true });
  }

  private async handleSetDataSources(request: Request): Promise<Response> {
    const { dataSources } = (await request.json()) as { dataSources: string[] };
    const report = await this.getReport();
    if (!report) return new Response("Report not found", { status: 404 });

    report.dataSources = dataSources;
    report.updatedAt = now();
    await this.state.storage.put("report", report);
    return this.jsonResponse({ ok: true });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async getReport(): Promise<ReportState | undefined> {
    return this.state.storage.get<ReportState>("report");
  }

  private jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
