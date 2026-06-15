import { test, expect } from "@playwright/test";

test.describe("Public canonical emitters", () => {
  test("publish root-level article URLs in feed and sitemap", async ({
    request,
  }) => {
    test.setTimeout(60_000);

    const [feedResponse, sitemapResponse] = await Promise.all([
      request.get("/api/feed"),
      request.get("/sitemap.xml"),
    ]);

    expect(feedResponse.ok()).toBe(true);
    expect(sitemapResponse.ok()).toBe(true);

    const [feedXml, sitemapXml] = await Promise.all([
      feedResponse.text(),
      sitemapResponse.text(),
    ]);

    expect(feedXml).not.toContain(
      "/blog/Uncategorized/ideas-for-personal-websites",
    );
    expect(sitemapXml).not.toContain(
      "/blog/Uncategorized/ideas-for-personal-websites",
    );
    expect(sitemapXml).not.toContain("/blog/search");
  });

  test("marks search as non-indexable in robots and metadata", async ({
    page,
    request,
  }) => {
    const robotsResponse = await request.get("/robots.txt");
    expect(robotsResponse.ok()).toBe(true);

    const robotsText = await robotsResponse.text();
    expect(robotsText).toContain("Disallow: /blog/search");

    await page.goto("/blog/search");

    await expect(
      page.locator('meta[name="robots"][content*="noindex"]'),
    ).toHaveCount(1);
  });

  test("serves a spec-compliant llms.txt link list under 100KB", async ({
    request,
  }) => {
    const response = await request.get("/llms.txt");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("# ");
    expect(body).toContain("/llms-full.txt");
    expect(body).toContain("/llms-articles.txt");
    // Should be a curated link list (markdown bullet links), not a body dump.
    expect(body).not.toContain("<p>");
    expect(body).not.toContain("Published: [object Object]");
    const sizeInBytes = Buffer.byteLength(body, "utf8");
    expect(sizeInBytes).toBeLessThan(100 * 1024);
  });

  test("serves the full-text dump at /llms-full.txt", async ({ request }) => {
    const response = await request.get("/llms-full.txt");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("# ");
    expect(body).toContain("Site:");
    // Full dump uses the fixed date + author helpers, never raw Firestore objects.
    expect(body).not.toContain("Published: [object Object]");
    expect(body).not.toContain("Author: blogsupportsheepai");
  });

  test("serves the complete article URL index at /llms-articles.txt", async ({
    request,
  }) => {
    const response = await request.get("/llms-articles.txt");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("Article URL Index");
    expect(body).toContain("Total articles:");
    expect(body).toContain("/llms-full.txt");
    expect(body).not.toContain("<p>");
    expect(body).not.toContain("Published: [object Object]");
  });

  test("serves permissive per-bot robots rules and an ai.txt preferences file", async ({
    request,
  }) => {
    const [robots, aiTxt] = await Promise.all([
      request.get("/robots.txt"),
      request.get("/.well-known/ai.txt"),
    ]);

    expect(robots.ok()).toBe(true);
    expect(aiTxt.ok()).toBe(true);

    const robotsText = await robots.text();
    expect(robotsText).toContain("User-Agent: Googlebot");
    expect(robotsText).toContain("User-Agent: OAI-SearchBot");
    expect(robotsText).toContain("User-Agent: Claude-SearchBot");
    expect(robotsText).toContain("User-Agent: Claude-User");
    expect(robotsText).toContain("User-Agent: PerplexityBot");
    expect(robotsText).toContain("User-Agent: Applebot");
    expect(robotsText).toContain("User-Agent: GPTBot");
    expect(robotsText).toContain("User-Agent: ClaudeBot");
    expect(robotsText).toContain("User-Agent: Applebot-Extended");
    expect(robotsText).toContain("User-Agent: CCBot");
    expect(robotsText).toContain("User-Agent: Bytespider");
    expect(robotsText).toContain("User-Agent: Google-Extended");
    expect(robotsText).toContain("User-Agent: GPTBot\nAllow: /");
    expect(robotsText).toContain("User-Agent: ClaudeBot\nAllow: /");
    expect(robotsText).toContain("User-Agent: Applebot-Extended\nAllow: /");
    expect(robotsText).toContain("User-Agent: Bytespider\nAllow: /");
    expect(robotsText).toContain("User-Agent: Google-Extended\nAllow: /");
    expect(robotsText).toContain("User-Agent: CCBot\nAllow: /");
    expect(robotsText).toContain("Allow: /ai/summary.json");
    expect(robotsText).toContain("Content-Signal: ai-train=yes");

    const aiTxtBody = await aiTxt.text();
    expect(aiTxtBody).toContain("Content-Signal: ai-train=yes");
    expect(aiTxtBody).toContain("Allow: /ai/summary.json");
    expect(aiTxtBody).toContain("User-Agent: *");
  });

  test("serves AI discovery JSON endpoints", async ({ request }) => {
    const [summary, faq, service] = await Promise.all([
      request.get("/ai/summary.json"),
      request.get("/ai/faq.json"),
      request.get("/ai/service.json"),
    ]);

    expect(summary.ok()).toBe(true);
    expect(faq.ok()).toBe(true);
    expect(service.ok()).toBe(true);

    const summaryJson = await summary.json();
    expect(summaryJson.aiPolicy.training).toBe("allowed");
    expect(summaryJson.discovery.articleIndex).toContain("/llms-articles.txt");

    const faqJson = await faq.json();
    expect(faqJson["@type"]).toBe("FAQPage");
    expect(faqJson.mainEntity.length).toBeGreaterThanOrEqual(4);

    const serviceJson = await service.json();
    expect(serviceJson.machineReadableResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: expect.stringContaining("/api/feed") }),
      ]),
    );
  });
});
