import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePublicSiteUrl: vi.fn(() => "https://blogbat.com"),
}));

vi.mock("@/lib/public-site", () => ({
  resolvePublicSiteUrl: mocks.resolvePublicSiteUrl,
}));

import { GET } from "@/app/robots.txt/route";

describe("robots.txt route", () => {
  beforeEach(() => {
    mocks.resolvePublicSiteUrl.mockClear();
  });

  it("welcomes search, answer, and training agents", async () => {
    const response = await GET();
    const body = await response.text();

    expect(body).toContain("User-Agent: Googlebot");
    expect(body).toContain("User-Agent: OAI-SearchBot");
    expect(body).toContain("User-Agent: Claude-SearchBot");
    expect(body).toContain("User-Agent: Claude-User");
    expect(body).toContain("User-Agent: PerplexityBot");
    expect(body).toContain("User-Agent: Applebot");

    expect(body).toContain("User-Agent: GPTBot\nAllow: /");
    expect(body).toContain("User-Agent: ClaudeBot\nAllow: /");
    expect(body).toContain("User-Agent: Applebot-Extended\nAllow: /");
    expect(body).toContain("User-Agent: Bytespider\nAllow: /");
    expect(body).toContain("User-Agent: Google-Extended\nAllow: /");
    expect(body).toContain("User-Agent: CCBot\nAllow: /");
    expect(body).not.toContain("Disallow: /\n");
    expect(body).toContain("Allow: /ai/summary.json");
    expect(body).toContain("Allow: /llms-articles.txt");

    expect(body).toContain(
      "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
    );
    expect(body).toContain("Sitemap: https://blogbat.com/sitemap.xml");
  });

  it("disallows /login (covering query-string variants) and legacy WordPress paths", async () => {
    const response = await GET();
    const body = await response.text();

    expect(body).toContain("Disallow: /login\n");
    expect(body).not.toContain("Disallow: /login/\n");
    expect(body).toContain("Disallow: /wp-admin/");
    expect(body).toContain("Disallow: /wp-content/");
    expect(body).toContain("Disallow: /wp-includes/");
    expect(body).toContain("Disallow: /wp-json/");
  });
});
