import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_ARTICLE = {
  id: "mock-id-1",
  title: "Ideas for Personal Websites",
  slug: "ideas-for-personal-websites",
  canonicalPath: "/ideas-for-personal-websites",
  body: "<p>Launch your site.</p>",
  author: "blogsupportsheepai",
  category: "Uncategorized",
  publishedAt: "2026-03-29T00:52:12.000Z",
  metaDescription: "A practical guide.",
  tags: ["personal website"],
  blogId: "default",
  status: "published",
};

const mocks = vi.hoisted(() => ({
  getBlogConfig: vi.fn(),
  resolvePublicSiteUrl: vi.fn(() => "https://supportsheep.com"),
  listPublishedArticles: vi.fn(),
}));

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mocks.getBlogConfig,
}));

vi.mock("@/lib/public-site", () => ({
  resolvePublicSiteUrl: mocks.resolvePublicSiteUrl,
}));

vi.mock("@/lib/articles/repository", () => ({
  listPublishedArticles: mocks.listPublishedArticles,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
}));

import {
  buildLlmsArticleIndexContent,
  buildLlmsFullTxtContent,
  buildLlmsTxtContent,
  buildLlmsTxtIndex,
} from "@/lib/llms-txt";

describe("buildLlmsTxtContent (full dump)", () => {
  beforeEach(() => {
    mocks.getBlogConfig.mockReset();
    mocks.resolvePublicSiteUrl.mockClear();
    mocks.listPublishedArticles.mockReset();
    mocks.listPublishedArticles.mockResolvedValue({ articles: [MOCK_ARTICLE], hasMore: false });
  });

  it("normalizes placeholder public metadata and sparse article authors", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Blog",
      siteDescription: "A modern blog",
    });

    const content = await buildLlmsTxtContent();

    expect(content).toContain("# Supportsheep");
    expect(content).toContain(
      "> Practical guides on building and ranking a small business website with Supportsheep's AI-powered tools.",
    );
    expect(content).toContain("Site: https://supportsheep.com");
    expect(content).not.toContain("Site: https://supportsheep.com/blog");
    expect(content).toContain("Author: Supportsheep");
  });

  it("shares behavior with buildLlmsFullTxtContent alias", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Supportsheep",
      siteDescription: "desc",
    });

    const direct = await buildLlmsFullTxtContent();
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Supportsheep",
      siteDescription: "desc",
    });
    const aliased = await buildLlmsTxtContent();
    expect(direct).toBe(aliased);
  });

  it("serializes Firestore Timestamp-like publishedAt values", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Supportsheep",
      siteDescription: "desc",
    });
    // D1 articles store ISO strings already, but normalizePublicDateValue handles
    // Timestamp-like objects too. Provide an ISO string equivalent here.
    mocks.listPublishedArticles.mockResolvedValue({
      articles: [
        {
          ...MOCK_ARTICLE,
          title: "Firestore Timestamp Article",
          slug: "firestore-timestamp-article",
          canonicalPath: "/firestore-timestamp-article",
          body: "<p>body</p>",
          author: "Jane",
          category: "Guides",
          publishedAt: "2026-04-16T00:00:00.000Z",
          tags: [],
        },
      ],
      hasMore: false,
    });
    const content = await buildLlmsFullTxtContent();
    expect(content).not.toContain("Published: [object Object]");
    expect(content).toContain("Published: 2026-04-16T00:00:00.000Z");
  });
});

describe("buildLlmsTxtIndex (spec-compliant link list)", () => {
  beforeEach(() => {
    mocks.getBlogConfig.mockReset();
    mocks.listPublishedArticles.mockReset();
    mocks.listPublishedArticles.mockResolvedValue({ articles: [MOCK_ARTICLE], hasMore: false });
  });

  it("emits a short overview with category-grouped markdown links", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Supportsheep",
      siteDescription: "Actionable guides",
    });

    const content = await buildLlmsTxtIndex();

    expect(content).toContain("# Supportsheep");
    expect(content).toContain("## Uncategorized");
    expect(content).toContain(
      "[Ideas for Personal Websites](https://supportsheep.com/ideas-for-personal-websites)",
    );
    expect(content).toContain("llms-full.txt");
    expect(content).toContain("llms-articles.txt");
    expect(content).not.toContain("<p>");
    expect(content).not.toContain("Launch your site.");
    expect(Buffer.byteLength(content, "utf8")).toBeLessThan(100 * 1024);
  });
});

describe("buildLlmsArticleIndexContent", () => {
  beforeEach(() => {
    mocks.getBlogConfig.mockReset();
    mocks.listPublishedArticles.mockReset();
    mocks.listPublishedArticles.mockResolvedValue({ articles: [MOCK_ARTICLE], hasMore: false });
  });

  it("emits the complete machine-readable article URL index without bodies", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      siteName: "Supportsheep",
      siteDescription: "Actionable guides",
    });

    const content = await buildLlmsArticleIndexContent();

    expect(content).toContain("# Supportsheep Article URL Index");
    expect(content).toContain("Total articles: 1");
    expect(content).toContain(
      "- [Ideas for Personal Websites](https://supportsheep.com/ideas-for-personal-websites)",
    );
    expect(content).toContain("Category: Uncategorized");
    expect(content).toContain("Published: 2026-03-29T00:52:12.000Z");
    expect(content).not.toContain("Launch your site.");
    expect(content).not.toContain("<p>");
  });
});
