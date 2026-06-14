import { describe, expect, it } from "vitest";
import {
  buildAiFaq,
  buildAiServiceProfile,
  buildAiSummary,
} from "@/lib/ai-discovery";

describe("AI discovery JSON builders", () => {
  const siteUrl = "https://supportsheep.com";

  it("builds a summary with canonical machine-readable resources", () => {
    const summary = buildAiSummary(siteUrl);

    expect(summary).toMatchObject({
      name: "Supportsheep",
      url: siteUrl,
      publisher: {
        name: "Supportsheep",
        url: "https://supportsheep.com",
      },
      discovery: {
        rss: `${siteUrl}/api/feed`,
        llmsTxt: `${siteUrl}/llms.txt`,
        articleIndex: `${siteUrl}/llms-articles.txt`,
        sitemap: `${siteUrl}/sitemap.xml`,
      },
      aiPolicy: {
        training: "allowed",
        search: "allowed",
        grounding: "allowed",
      },
    });
    expect(summary.primaryTopics.length).toBeGreaterThanOrEqual(5);
  });

  it("builds FAQPage-shaped data for answer engines", () => {
    const faq = buildAiFaq(siteUrl);

    expect(faq).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url: `${siteUrl}/ai/faq.json`,
    });
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    expect(faq.mainEntity[0]).toMatchObject({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
      },
    });
  });

  it("builds a service profile with citations and contact data", () => {
    const service = buildAiServiceProfile(siteUrl);

    expect(service).toMatchObject({
      serviceType: "AI website builder blog and small business education hub",
      provider: {
        name: "Supportsheep",
        url: "https://supportsheep.com",
      },
      contact: {
        supportUrl: "https://support.supportsheep.com",
      },
      machineReadableResources: expect.arrayContaining([
        expect.objectContaining({
          name: "RSS feed",
          url: `${siteUrl}/api/feed`,
        }),
      ]),
    });
    expect(service.capabilities.length).toBeGreaterThanOrEqual(4);
  });
});
