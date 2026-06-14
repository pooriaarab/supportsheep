/**
 * Integration smoke-test for the dev-interview-harness ↔ LLM_PROVIDER=mock
 * wiring. The harness lives outside `src/` so vitest does not pick it up
 * directly — instead we assert the on-disk script:
 *   1. Sets `LLM_PROVIDER=mock` in the env defaults it writes / merges.
 *   2. Prints the "Mock mode active" banner when the merged child env
 *      has the flag set.
 *
 * The test is deliberately textual rather than dynamic because the
 * harness is a CLI script that spawns `bun run dev`; running it in
 * vitest would boot Next.js. A regex check is enough to guarantee the
 * banner / env wiring never silently regress.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HARNESS_PATH = join(
  process.cwd(),
  "scripts",
  "dev-interview-harness.ts",
);

describe("dev-interview-harness", () => {
  const source = readFileSync(HARNESS_PATH, "utf-8");

  test("sets LLM_PROVIDER=mock in HARNESS_ENV_DEFAULTS", () => {
    expect(source).toMatch(/LLM_PROVIDER:\s*"mock"/);
  });

  test("prints the Mock mode active banner when LLM_PROVIDER=mock", () => {
    expect(source).toMatch(/Mock mode active/);
    expect(source).toMatch(/childEnv\.LLM_PROVIDER\s*===\s*"mock"/);
  });

  test("supplies mock api keys so the @ai-sdk providers construct", () => {
    expect(source).toMatch(/ANTHROPIC_API_KEY:\s*"mock-anthropic-key"/);
    expect(source).toMatch(/OPENAI_API_KEY:\s*"mock-openai-key"/);
  });
});
