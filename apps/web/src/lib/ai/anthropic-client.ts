import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/logger";
import { createMockAnthropic } from "./mock-anthropic";

const log = createLogger("ai:anthropic-client");

/**
 * Returns true when the in-process Anthropic mock should be used instead
 * of a real `new Anthropic({ apiKey })`. Gated on BOTH `LLM_PROVIDER=mock`
 * AND `NODE_ENV !== "production"` so the mock can never accidentally ship
 * to production — even if the env flag leaks. Belt + suspenders by design;
 * the env-flag-only check is too easy to set in a deploy environment.
 */
export function isMockAnthropicEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LLM_PROVIDER === "mock"
  );
}

/**
 * Construct an Anthropic client (real or mock) for the writer-worker,
 * follow-up-suggester, and async-stitcher call sites. Call sites must
 * use this factory instead of `new Anthropic({ apiKey })` directly so
 * `LLM_PROVIDER=mock` is honored consistently and the dev-interview
 * harness no longer burns real Anthropic spend on every local QA run.
 */
export function createAnthropicClient(opts: { apiKey?: string }): Anthropic {
  if (isMockAnthropicEnabled()) {
    log.info("Using mock Anthropic client (LLM_PROVIDER=mock)");
    return createMockAnthropic() as unknown as Anthropic;
  }
  if (!opts.apiKey) {
    throw new Error(
      "createAnthropicClient requires apiKey when LLM_PROVIDER!=mock",
    );
  }
  return new Anthropic({ apiKey: opts.apiKey });
}
