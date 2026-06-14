/**
 * AI Text Generation Helper
 *
 * Wraps the Vercel AI SDK `generateText` with the multi-provider client.
 * Used by the generation pipeline for title + body generation.
 */

import "server-only";

import { generateText } from "ai";
import { getProviderModel, type AIProvider } from "./providers";

export async function generateContent(opts: {
  provider: AIProvider;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const model = await getProviderModel(opts.provider);

  const { text } = await generateText({
    model,
    system: opts.systemPrompt,
    prompt: opts.userPrompt,
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxTokens,
  });

  return text;
}
