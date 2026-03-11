import { PRIMARY_MODEL, FALLBACK_MODEL } from "../config";
import type { Env } from "../types";

type AiTextResponse = {
  response?: string;
};

/**
 * Calls Workers AI with the given prompt.
 * Tries the primary model (llama-3.3-70b) first.
 * Falls back to the smaller model (llama-3.1-8b) on any error.
 */
export async function callAI(env: Env, prompt: string, maxTokens: number): Promise<string> {
  const messages = [{ role: "user" as const, content: prompt }];

  // Try primary model first
  try {
    const result = await env.AI.run(PRIMARY_MODEL, {
      messages,
      max_tokens: maxTokens,
    }) as AiTextResponse;

    const text = result?.response?.trim();
    if (text) return text;
    throw new Error("Empty response from primary model");
  } catch (primaryErr) {
    console.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}:`, primaryErr);
  }

  // Fallback model
  const fallbackResult = await env.AI.run(FALLBACK_MODEL, {
    messages,
    max_tokens: maxTokens,
  }) as AiTextResponse;

  const fallbackText = fallbackResult?.response?.trim();
  if (!fallbackText) {
    throw new Error("Both AI models returned empty responses");
  }
  return fallbackText;
}
