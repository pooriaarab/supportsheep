import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Belt-and-suspenders test for the W7.6 Bug 6.3 fix: deploy-preview and
 * branch-deploy contexts MUST enable INTERVIEW_E2E_TEST_SEED and
 * INTERVIEW_MAGIC_LINK_TEST_CAPTURE so the test-only seed routes respond
 * (PRs #225/#233 depend on this). Production MUST NOT enable either flag
 * because the routes would mint sessions / dispatch tools in prod.
 *
 * Parses netlify.toml with a tiny regex-based section reader so we don't
 * need a TOML-parser dependency for one test.
 */

type TomlSections = Record<string, Record<string, string>>;

function parseTomlSections(text: string): TomlSections {
  const sections: TomlSections = {};
  let current: string | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      sections[current] ??= {};
      continue;
    }
    if (!current) continue;
    const kvMatch = /^([A-Za-z0-9_.-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(
      line,
    );
    if (kvMatch) {
      sections[current][kvMatch[1]] = kvMatch[2];
    }
  }
  return sections;
}

const tomlPath = join(__dirname, "..", "..", "..", "netlify.toml");
const sections = parseTomlSections(readFileSync(tomlPath, "utf8"));

describe("netlify.toml per-context env invariants", () => {
  it("enables INTERVIEW_E2E_TEST_SEED on deploy-preview", () => {
    expect(sections["context.deploy-preview.environment"]).toBeDefined();
    expect(
      sections["context.deploy-preview.environment"].INTERVIEW_E2E_TEST_SEED,
    ).toBe("true");
  });

  it("enables INTERVIEW_MAGIC_LINK_TEST_CAPTURE on deploy-preview", () => {
    expect(
      sections["context.deploy-preview.environment"]
        .INTERVIEW_MAGIC_LINK_TEST_CAPTURE,
    ).toBe("true");
  });

  it("enables both flags on branch-deploy", () => {
    const ctx = sections["context.branch-deploy.environment"];
    expect(ctx).toBeDefined();
    expect(ctx.INTERVIEW_E2E_TEST_SEED).toBe("true");
    expect(ctx.INTERVIEW_MAGIC_LINK_TEST_CAPTURE).toBe("true");
  });

  it("does NOT enable test-only flags on production", () => {
    const ctx = sections["context.production.environment"] ?? {};
    expect(ctx.INTERVIEW_E2E_TEST_SEED).toBeUndefined();
    expect(ctx.INTERVIEW_MAGIC_LINK_TEST_CAPTURE).toBeUndefined();
  });

  it("does NOT define test-only flags in [build.environment] (would leak into prod)", () => {
    const buildEnv = sections["build.environment"] ?? {};
    expect(buildEnv.INTERVIEW_E2E_TEST_SEED).toBeUndefined();
    expect(buildEnv.INTERVIEW_MAGIC_LINK_TEST_CAPTURE).toBeUndefined();
  });

  it("does NOT hard-code dev-login secrets in netlify.toml (UI-only)", () => {
    for (const [, kv] of Object.entries(sections)) {
      expect(kv.ENABLE_DEV_LOGIN).toBeUndefined();
      expect(kv.DEV_LOGIN_SECRET).toBeUndefined();
    }
  });
});
