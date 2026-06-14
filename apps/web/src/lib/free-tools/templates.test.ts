import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FREE_TOOL_TEMPLATES,
  FREE_TOOL_TEMPLATE_LIST,
  getFreeToolTemplate,
  runDeterministicTool,
} from "./templates";
import { buildDefaultFreeTools } from "./defaults";

describe("free tool templates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a broad predefined catalog with unique template IDs and slugs", () => {
    const sourceIds = FREE_TOOL_TEMPLATE_LIST.map((template) => template.id);
    const sourceSlugs = FREE_TOOL_TEMPLATE_LIST.map(
      (template) => template.slug,
    );
    const ids = Object.keys(FREE_TOOL_TEMPLATES);
    expect(ids.length).toBeGreaterThanOrEqual(50);
    expect(ids).toHaveLength(FREE_TOOL_TEMPLATE_LIST.length);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(new Set(sourceSlugs).size).toBe(sourceSlugs.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes Elementor-inspired deterministic utility tools for PSEO coverage", () => {
    expect(Object.keys(FREE_TOOL_TEMPLATES)).toEqual(
      expect.arrayContaining([
        "html-viewer",
        "html-to-image-generator",
        "html-minifier",
        "css-online-editor",
        "css-validator",
        "blog-post-ideas-generator",
        "javascript-minifier",
        "robots-txt-generator",
        "text-diff-tool",
        "aspect-ratio-calculator",
        "nps-calculator",
        "url-decoder",
      ]),
    );
  });

  it("includes the second wave of pSEO calculator and formatter tools", () => {
    expect(Object.keys(FREE_TOOL_TEMPLATES)).toEqual(
      expect.arrayContaining([
        "conversion-rate-calculator",
        "click-through-rate-calculator",
        "cpm-calculator",
        "cpc-calculator",
        "email-open-rate-calculator",
        "email-click-through-rate-calculator",
        "instagram-engagement-calculator",
        "tiktok-engagement-calculator",
        "json-formatter",
        "word-density-counter",
        "title-capitalization-tool",
        "utm-url-parser",
      ]),
    );
  });

  it("rejects unknown template IDs", () => {
    expect(getFreeToolTemplate("missing-template")).toBeNull();
  });

  it("runs deterministic word count without AI", async () => {
    const result = await runDeterministicTool("word-counter", {
      text: "Build useful free tools for search traffic.",
    });
    if (result.kind !== "stats") {
      throw new Error("Expected stats result");
    }
    expect(result.summary).toContain("7 words");
    expect(result.summary).toContain("1 min read");
    expect(result.metrics).toMatchObject({
      words: 7,
      readingTimeMinutes: 1,
    });
  });

  it("generates passwords without Math.random", async () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used for passwords");
    });

    const result = await runDeterministicTool("password-generator", {
      length: 24,
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toHaveLength(24);
  });

  it("returns a controlled UTM result for invalid URLs", async () => {
    const result = await runDeterministicTool("utm-generator", {
      url: "not a url",
      source: "solo_blog",
      medium: "free_tool",
      campaign: "word-counter",
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.summary).toBe("Enter a valid http or https URL");
    expect(result.text).toBe("");
  });

  it("minifies JavaScript without changing string literal content", async () => {
    const result = await runDeterministicTool("javascript-minifier", {
      code: 'const label = "a + b"; // remove comment\nconsole.log(label);',
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toBe('const label="a + b";console.log(label);');
  });

  it("escapes single quotes in generated HTML attributes", async () => {
    const result = await runDeterministicTool("aria-label-generator", {
      element: "button",
      action: "Open",
      context: "Bob's menu",
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toContain('aria-label="Open Bob&#39;s menu"');
  });

  it("minifies HTML by removing comments and excess whitespace", async () => {
    const result = await runDeterministicTool("html-minifier", {
      html: "<main>  <!-- remove -->  <h1>Hello</h1>   <p>World</p> </main>",
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toBe("<main><h1>Hello</h1><p>World</p></main>");
  });

  it("generates a robots.txt file with sitemap and crawl delay", async () => {
    const result = await runDeterministicTool("robots-txt-generator", {
      domain: "https://blogbat.com",
      disallow: "/dashboard\n/api",
      sitemapPath: "/sitemap.xml",
      crawlDelay: 5,
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toContain("User-agent: *");
    expect(result.text).toContain("Disallow: /dashboard");
    expect(result.text).toContain("Disallow: /api");
    expect(result.text).toContain("Crawl-delay: 5");
    expect(result.text).toContain(
      "Sitemap: https://blogbat.com/sitemap.xml",
    );
  });

  it("calculates a missing aspect-ratio height from width and ratio", async () => {
    const result = await runDeterministicTool("aspect-ratio-calculator", {
      width: 1920,
      ratioWidth: 16,
      ratioHeight: 9,
    });

    if (result.kind !== "stats") {
      throw new Error("Expected stats result");
    }
    expect(result.metrics).toMatchObject({
      width: 1920,
      height: 1080,
      ratio: "16:9",
    });
  });

  it("calculates net promoter score from survey counts", async () => {
    const result = await runDeterministicTool("nps-calculator", {
      promoters: 72,
      passives: 18,
      detractors: 10,
    });

    if (result.kind !== "stats") {
      throw new Error("Expected stats result");
    }
    expect(result.metrics).toMatchObject({
      totalResponses: 100,
      nps: 62,
      promoterPercent: 72,
      detractorPercent: 10,
    });
  });

  it("calculates conversion rate from visitors and conversions", async () => {
    const result = await runDeterministicTool("conversion-rate-calculator", {
      visitors: 1000,
      conversions: 73,
    });

    if (result.kind !== "stats") {
      throw new Error("Expected stats result");
    }
    expect(result.metrics).toMatchObject({
      visitors: 1000,
      conversions: 73,
      conversionRate: 7.3,
    });
  });

  it("decodes percent-encoded URLs", async () => {
    const result = await runDeterministicTool("url-decoder", {
      text: "https%3A%2F%2Fblogbat.com%2Ftools%3Fq%3Dfree%2520tools",
    });

    if (result.kind !== "text") {
      throw new Error("Expected text result");
    }
    expect(result.text).toBe("https://blogbat.com/tools?q=free%20tools");
  });

  it("builds enabled seeded documents with the spec document shape", () => {
    const tools = buildDefaultFreeTools({ enabled: true, aiEnabled: false });
    const wordCounter = tools.find((tool) => tool.id === "word-counter");

    expect(tools.length).toBeGreaterThanOrEqual(50);
    expect(tools.every((tool) => tool.enabled)).toBe(true);
    expect(
      tools.every((tool) => tool.seo.canonicalPath.startsWith("/tools/")),
    ).toBe(true);
    expect(wordCounter).toMatchObject({
      id: "word-counter",
      blogId: "default",
      templateId: "word-counter",
      source: "predefined",
      slug: "word-counter",
      title: "Word Counter",
      metaTitle: "Free Word Counter",
      metaDescription:
        "Count words and characters for blog posts, pages, and social copy.",
      cta: {
        label: "Try BlogBat",
        url: "https://blogbat.com/",
      },
      callout: {
        enabled: true,
        heading: "Build your website with BlogBat",
        body: "Turn this free tool result into a website, blog post, or landing page with BlogBat.",
        primaryLabel: "Try BlogBat",
        primaryUrl: "https://blogbat.com/",
        secondaryLabel: "Learn more",
        secondaryUrl: "https://blogbat.com/",
        utm: {
          source: "blogbat_blog",
          medium: "free_tool",
          campaign: "{{toolSlug}}",
          content: "bottom_callout",
          term: "",
        },
      },
      appearance: {
        layout: "utility",
        accent: "default",
      },
      ai: {
        enabled: false,
        provider: "claude",
        model: "",
        dailyLimit: 10,
        maxInputChars: 12000,
        maxOutputTokens: 1200,
      },
      seo: {
        indexable: true,
        canonicalPath: "/tools/word-counter",
        includeInToolsIndex: true,
        includeInSitemap: true,
      },
    });
    expect(wordCounter?.intro).toContain("Word Counter");
    expect(wordCounter?.faq).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: expect.any(String),
          answer: expect.any(String),
        }),
      ]),
    );
  });
});
