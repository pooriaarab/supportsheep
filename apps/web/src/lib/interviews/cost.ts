/**
 * Provider pricing snapshots and cost-calculation helpers for an interview
 * session. All rates are USD per million tokens (or per image / per GB) and
 * reflect public published pricing as of 2026-05-22.
 *
 * Sources (cited inline next to each constant):
 *  - OpenAI Realtime API:  https://openai.com/api/pricing/
 *  - Anthropic Claude:     https://www.anthropic.com/pricing
 *  - OpenAI image (gpt-image-1): https://openai.com/api/pricing/
 *  - Replicate FLUX.1 schnell: https://replicate.com/black-forest-labs/flux-schnell
 *  - Firebase Cloud Storage: https://firebase.google.com/pricing
 *
 * When pricing changes, update the constant AND the comment so the audit
 * trail stays self-explanatory.
 */

/**
 * OpenAI Realtime API token pricing (USD per 1,000,000 tokens).
 *
 * Model: gpt-realtime (GA, audio + text), as of 2026-05-22.
 *  - Audio input:        $32 / M
 *  - Cached audio input: $0.40 / M  (98.75% discount vs. fresh input)
 *  - Audio output:       $64 / M
 *  - Text input:         $4  / M
 *  - Text output:        $16 / M
 *
 * Interview sessions use the audio-in/audio-out path; the realtime
 * usage events report consolidated input_tokens + output_tokens that
 * are dominated by audio tokens. We bill the audio rates as the
 * conservative (more expensive) bound.
 */
export const REALTIME_PRICING_USD_PER_M = {
  /** Audio input tokens — $32/M per OpenAI public pricing. */
  input: 32,
  /** Cached audio input tokens — $0.40/M (prompt cache hit). */
  cachedInput: 0.4,
  /** Audio output tokens — $64/M. */
  output: 64,
  /** Text input fallback rate — $4/M (used when usage block lacks an audio flag). */
  textInput: 4,
  /** Text output fallback rate — $16/M. */
  textOutput: 16,
} as const;

/**
 * Anthropic Claude pricing per model (USD per 1,000,000 tokens).
 * Source: https://www.anthropic.com/pricing as of 2026-05-22.
 *
 *  - Sonnet 4.6: $3 input / $0.30 cached / $15 output
 *  - Haiku 4.5:  $1 input / $0.10 cached / $5  output
 *
 * `WRITER_PRICING_USD_PER_M` aliases Sonnet 4.6 because the writer-worker
 * uses `claude-sonnet-4-6`. Haiku rates are exposed for any sub-tool that
 * may downshift (e.g. follow-up suggestions or async stitching).
 */
export const CLAUDE_SONNET_46_PRICING_USD_PER_M = {
  input: 3,
  cachedInput: 0.3,
  output: 15,
} as const;

export const CLAUDE_HAIKU_45_PRICING_USD_PER_M = {
  input: 1,
  cachedInput: 0.1,
  output: 5,
} as const;

/** Backwards-compatible alias used by call sites that bill against the writer (Sonnet 4.6). */
export const WRITER_PRICING_USD_PER_M = CLAUDE_SONNET_46_PRICING_USD_PER_M;

/**
 * Image-generation per-image cost (USD).
 *
 *  - gpt-image-1 (high quality, landscape): ~$0.19/image as of 2026-05-22.
 *  - Replicate FLUX.1 schnell:              ~$0.003/image (4-step model).
 *
 * Unsplash lookups are free and intentionally absent.
 */
export const IMAGE_PRICING_USD_PER_IMAGE = {
  /** OpenAI gpt-image-1 high-quality landscape. */
  gptImage1: 0.19,
  /** Replicate `black-forest-labs/flux-schnell`. */
  fluxSchnell: 0.003,
  /** Unsplash CDN lookups. */
  unsplash: 0,
} as const;

/**
 * Firebase Cloud Storage standard pricing (us-central1 multi-region).
 *  - Storage: $0.026/GB-month
 *  - Bandwidth egress (worldwide): $0.12/GB
 *
 * The interview session writes audio recordings + image uploads. Per-byte
 * cost is computed against `storage` only — egress is amortized into the
 * shared workspace bill and isn't attributable to a single session.
 */
export const FIREBASE_STORAGE_PRICING = {
  /** $/GB/month for object storage at rest. */
  perGbMonth: 0.026,
  /** $/GB egress (informational; not currently billed per-session). */
  perGbEgress: 0.12,
} as const;

export interface RealtimeTokens {
  input: number;
  output: number;
  /** Optional cached input portion — billed at the prompt-cache rate when present. */
  cachedInput?: number;
}

export interface WriterTokens {
  input: number;
  cachedInput: number;
  output: number;
}

/**
 * Compute the realtime audio cost for a turn given its OpenAI usage block.
 *
 * `cachedInput` is the portion of input that hit the prompt cache. When the
 * caller passes `cachedInput`, the cached portion is billed at the cache
 * rate and the remainder of `input` is billed at the fresh rate.
 */
export function computeRealtimeCost(tokens: RealtimeTokens): number {
  const cached = tokens.cachedInput ?? 0;
  const freshInput = Math.max(0, tokens.input - cached);
  return (
    (freshInput * REALTIME_PRICING_USD_PER_M.input) / 1_000_000 +
    (cached * REALTIME_PRICING_USD_PER_M.cachedInput) / 1_000_000 +
    (tokens.output * REALTIME_PRICING_USD_PER_M.output) / 1_000_000
  );
}

/**
 * Compute the writer (Anthropic Claude) cost for a job given its usage
 * block. `cachedInput` is the prompt-cache-hit portion of input; the rest
 * is billed at the fresh input rate, output at the output rate.
 */
export function computeWriterCost(tokens: WriterTokens): number {
  return (
    (tokens.input * WRITER_PRICING_USD_PER_M.input) / 1_000_000 +
    (tokens.cachedInput * WRITER_PRICING_USD_PER_M.cachedInput) / 1_000_000 +
    (tokens.output * WRITER_PRICING_USD_PER_M.output) / 1_000_000
  );
}

/**
 * Compute the Haiku 4.5 cost for a job (lightweight follow-up suggestion
 * or async stitch fallback). Same shape as `computeWriterCost` but bills
 * against the cheaper Haiku rates.
 */
export function computeHaikuCost(tokens: WriterTokens): number {
  return (
    (tokens.input * CLAUDE_HAIKU_45_PRICING_USD_PER_M.input) / 1_000_000 +
    (tokens.cachedInput * CLAUDE_HAIKU_45_PRICING_USD_PER_M.cachedInput) / 1_000_000 +
    (tokens.output * CLAUDE_HAIKU_45_PRICING_USD_PER_M.output) / 1_000_000
  );
}

/**
 * Compute the cost of a generated image. `provider` selects the rate.
 * Use this for any new image-cost-event records so the per-image USD is
 * tied to the actual model that produced the image.
 */
export function computeImageCost(
  provider: keyof typeof IMAGE_PRICING_USD_PER_IMAGE,
  count = 1,
): number {
  return IMAGE_PRICING_USD_PER_IMAGE[provider] * count;
}

/**
 * Compute the prorated storage cost for an object of `bytes` size held for
 * `months`. Defaults to 1 month so a single write attributes the full
 * month's storage charge to the session that produced it — conservative.
 */
export function computeStorageCost(bytes: number, months = 1): number {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb * FIREBASE_STORAGE_PRICING.perGbMonth * months;
}

export function computeTotalCost(realtime: RealtimeTokens, writer: WriterTokens): number {
  return computeRealtimeCost(realtime) + computeWriterCost(writer);
}

export function roundCostUsd(amount: number): number {
  // 4 decimal places (sub-cent precision for typical $0.001-$2 calls)
  return Math.round(amount * 10000) / 10000;
}
