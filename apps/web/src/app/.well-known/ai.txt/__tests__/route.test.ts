import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePublicSiteUrl: vi.fn(() => "https://supportsheep.com"),
}));

vi.mock("@/lib/public-site", () => ({
  resolvePublicSiteUrl: mocks.resolvePublicSiteUrl,
}));

import { GET } from "@/app/.well-known/ai.txt/route";

describe(".well-known/ai.txt route", () => {
  beforeEach(() => {
    mocks.resolvePublicSiteUrl.mockClear();
  });

  it("publishes a permissive AI training and discovery policy", async () => {
    const response = await GET();
    const body = await response.text();

    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Allow: /ai/summary.json");
    expect(body).toContain("Allow: /ai/faq.json");
    expect(body).toContain("Allow: /ai/service.json");
    expect(body).toContain("Allow: /llms-articles.txt");
    expect(body).toContain(
      "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
    );
    expect(body).toContain("# - Model training (ai-train): allowed");
    expect(body).toContain("Sitemap: https://supportsheep.com/sitemap.xml");
  });
});
