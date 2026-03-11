import { callAI } from "./ai";
import {
  overviewPrompt,
  bullCasePrompt,
  bearCasePrompt,
  keyRisksPrompt,
  conclusionPrompt,
  finalMemoPrompt,
} from "../prompts";
import { MAX_TOKENS_SECTION, MAX_TOKENS_MEMO } from "../config";
import type { Env, CompanyContext, ReportSections } from "../types";

export async function generateOverview(
  env: Env,
  ctx: CompanyContext,
  focusPrompt?: string
): Promise<string> {
  return callAI(env, overviewPrompt(ctx, focusPrompt), MAX_TOKENS_SECTION);
}

export async function generateBullCase(
  env: Env,
  ctx: CompanyContext,
  overview: string,
  focusPrompt?: string
): Promise<string> {
  return callAI(env, bullCasePrompt(ctx, overview, focusPrompt), MAX_TOKENS_SECTION);
}

export async function generateBearCase(
  env: Env,
  ctx: CompanyContext,
  overview: string,
  focusPrompt?: string
): Promise<string> {
  return callAI(env, bearCasePrompt(ctx, overview, focusPrompt), MAX_TOKENS_SECTION);
}

export async function generateKeyRisks(
  env: Env,
  ctx: CompanyContext,
  bullCase: string,
  bearCase: string,
  focusPrompt?: string
): Promise<string> {
  return callAI(env, keyRisksPrompt(ctx, bullCase, bearCase, focusPrompt), MAX_TOKENS_SECTION);
}

export async function generateConclusion(
  env: Env,
  ctx: CompanyContext,
  overview: string,
  bullCase: string,
  bearCase: string,
  keyRisks: string,
  focusPrompt?: string
): Promise<{ whatToWatch: string; bottomLine: string }> {
  const raw = await callAI(
    env,
    conclusionPrompt(ctx, overview, bullCase, bearCase, keyRisks, focusPrompt),
    MAX_TOKENS_SECTION
  );

  // Split the combined conclusion response into its two sub-sections
  const watchMatch = raw.match(/##\s*What to Watch([\s\S]*?)(?=##\s*Bottom Line|$)/i);
  const bottomMatch = raw.match(/##\s*Bottom Line([\s\S]*?)$/i);

  return {
    whatToWatch: watchMatch ? watchMatch[1].trim() : raw,
    bottomLine: bottomMatch ? bottomMatch[1].trim() : "",
  };
}

export async function synthesizeFinalMemo(
  env: Env,
  ctx: CompanyContext,
  sections: Required<Omit<ReportSections, "finalMemo">>,
  focusPrompt?: string
): Promise<string> {
  return callAI(env, finalMemoPrompt(ctx, sections, focusPrompt), MAX_TOKENS_MEMO);
}
