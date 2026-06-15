/**
 * Multi-Provider AI Client
 *
 * Fetches API keys from the knowledge base's D1 configuration. Keys MUST be configured
 * via Settings > AI Providers in the dashboard — there is no environment-variable
 * fallback so the UI is the single source of truth.
 */

import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getBlogConfig } from "@/lib/blog-config";

export type AIProvider = "claude" | "gpt" | "gemini";

interface ProviderConfig {
  apiKey?: string;
  model?: string;
}

interface AISettings {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  claude: "claude-sonnet-4-6",
  gpt: "gpt-5.4-mini",
  gemini: "gemini-2.5-flash",
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  claude: "Claude",
  gpt: "OpenAI",
  gemini: "Gemini",
};

function nonEmptyTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

async function readProviderConfig(
  provider: AIProvider,
): Promise<ProviderConfig | undefined> {
  const config = await getBlogConfig();
  const providers = config?.ai?.providers as
    | Record<string, ProviderConfig>
    | undefined;
  return providers?.[provider];
}

/**
 * Resolve a provider's API key and (optionally) configured model from
 * the knowledge base's D1 configuration. Throws if no API key is configured.
 */
export async function getProviderSettings(
  provider: AIProvider,
): Promise<AISettings> {
  const cfg = await readProviderConfig(provider);
  const apiKey = nonEmptyTrimmed(cfg?.apiKey);
  if (!apiKey) {
    throw new Error(
      `${PROVIDER_LABELS[provider]} API key not configured. Add it in Settings > AI Providers.`,
    );
  }
  return { apiKey, model: nonEmptyTrimmed(cfg?.model) };
}

/**
 * Convenience for callers that only need the raw API key (e.g. direct
 * Anthropic / OpenAI / fetch calls outside the Vercel AI SDK).
 */
export async function getProviderApiKey(provider: AIProvider): Promise<string> {
  return (await getProviderSettings(provider)).apiKey;
}

/**
 * Get a Vercel AI SDK model instance for the given provider.
 */
export async function getProviderModel(
  provider: AIProvider,
  modelOverride?: string,
) {
  const { apiKey, model: settingsModel } = await getProviderSettings(provider);
  const modelId =
    nonEmptyTrimmed(modelOverride) ?? settingsModel ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "claude":
      return createAnthropic({ apiKey })(modelId);
    case "gpt":
      return createOpenAI({ apiKey })(modelId);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(modelId);
  }
}
