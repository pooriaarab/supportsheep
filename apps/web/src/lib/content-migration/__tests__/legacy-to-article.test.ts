import { describe, expect, it } from "vitest";
import {
  appendFaqBlock,
  buildComparisonSlugs,
  convertPillarToArticleInput,
  convertProgrammaticToArticleInput,
  renderMarkdownishBodyToHtml,
} from "@/lib/content-migration/legacy-to-article";

describe("legacy-to-article", () => {
  it("maps a /for page into a landing_page article input", () => {
    const result = convertProgrammaticToArticleInput({
      id: "plumbers",
      collection: "for",
      title: "BlogBat for Plumbers",
      metaDescription: "Rank your plumbing business.",
      uniqueContent: "## Why plumbers need better websites\n\n- More leads",
      faqs: [{ question: "Q?", answer: "A." }],
      variables: {
        subhead: "Built for local leads.",
        ctaText: "Start",
        ctaHref: "https://blogbat.com",
      },
    });

    expect(result.slug).toBe("plumbers");
    expect(result.postType).toBe("landing_page");
    expect(result.sourcePath).toBe("/for/plumbers");
    expect(result.body).toContain('data-block="faq"');
    expect(result.body).toContain("<h2>Why plumbers need better websites</h2>");
  });

  it("maps alternatives_for_vertical ids into flat comparison slugs", () => {
    const result = convertProgrammaticToArticleInput({
      id: "wix__dentists",
      collection: "alternatives_for_vertical",
      title: "Wix for dentists",
      metaDescription: "Compare Wix and BlogBat for dentists.",
      uniqueContent: "## TL;DR\n\nWix is flexible.",
      faqs: [],
      variables: {},
    });

    expect(result.slug).toBe("wix-for-dentists");
    expect(result.postType).toBe("comparison");
    expect(result.sourcePath).toBeNull();
  });

  it("maps a pillar into a pillar_page article input", () => {
    const result = convertPillarToArticleInput({
      slug: "seo-for-service-businesses",
      title: "SEO for Service Businesses",
      summary: "Rank locally.",
      heroEyebrow: "Pillar",
      clusters: [
        {
          title: "SEO fundamentals",
          description: "Core topics",
          articleSlugs: ["seo-for-beginners"],
        },
      ],
      order: 1,
      updatedAt: "2026-04-22T00:00:00.000Z",
    });

    expect(result.slug).toBe("seo-for-service-businesses");
    expect(result.postType).toBe("pillar_page");
    expect(result.sourcePath).toBe("/guides/seo-for-service-businesses");
    expect(result.body).toContain("/seo-for-beginners");
  });

  it("builds flat comparison slugs without route prefixes", () => {
    expect(buildComparisonSlugs("wix")).toEqual({
      alternativeSlug: "wix-alternative",
      vsSlug: "blogbat-vs-wix",
    });
  });

  it("renders markdown-like programmatic content into html", () => {
    expect(
      renderMarkdownishBodyToHtml(
        "## Heading\n\nA paragraph with **bold**.\n\n- One\n- Two",
      ),
    ).toContain("<ul><li>One</li><li>Two</li></ul>");
  });

  it("appends FAQ HTML only when FAQ rows exist", () => {
    expect(appendFaqBlock("<p>Body</p>", [])).toBe("<p>Body</p>");
  });
});
