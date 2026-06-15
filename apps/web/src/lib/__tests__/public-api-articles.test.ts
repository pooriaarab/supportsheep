import { afterEach, describe, expect, it, vi } from "vitest";
import * as articleModule from "@/lib/public-api/articles";
import { createMemoryRateLimiter } from "@/lib/public-api/rate-limit";
import * as siteModule from "@/lib/public-site";
import { GET as listArticles } from "../../app/api/v1/public/articles/route.ts";
import { GET as getArticleBySlug } from "../../app/api/v1/public/articles/[slug]/route.ts";

const {
  clampPublicLimit,
  clampPublicPage,
  serializePublicArticleDetail,
  serializePublicArticleSummary,
} = articleModule;

describe("public api article helpers", () => {
  it("caps page and limit inputs", () => {
    expect(clampPublicPage("999")).toBe(100);
    expect(clampPublicPage("0")).toBe(1);
    expect(clampPublicLimit("200")).toBe(50);
    expect(clampPublicLimit("1")).toBe(1);
  });

  it("serializes only public-safe summary fields", () => {
    const article = {
      slug: "Article",
      title: "Article",
      canonicalPath: "/post",
      excerpt: "Summary",
      category: "Guides",
      tags: ["seo"],
      readingTime: 3,
      publishedAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    };

    expect(
      serializePublicArticleSummary(article, "https://supportsheep.com"),
    ).toEqual({
      title: "Article",
      slug: "Article",
      url: "https://supportsheep.com/post",
      excerpt: "Summary",
      category: "Guides",
      tags: ["seo"],
      publishedAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
      readingTime: 3,
    });
  });

  it("serializes public detail fields without leaking internals", () => {
    const article = {
      slug: "Article",
      title: "Article",
      canonicalPath: "/post",
      excerpt: "Summary",
      body: "<p>Published body</p>",
      category: "Guides",
      tags: ["seo"],
      author: "Supportsheep",
      readingTime: 3,
      publishedAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
      metaTitle: "Meta",
      metaDescription: "Desc",
    };

    const detail = serializePublicArticleDetail(
      article,
      "https://supportsheep.com",
    );
    expect(detail).toMatchObject({
      title: "Article",
      slug: "Article",
      url: "https://supportsheep.com/post",
      body: "<p>Published body</p>",
    });
    expect(detail).not.toHaveProperty("versions");
  });
});

describe("public api rate limiter", () => {
  it("allows requests until the limit is exhausted", () => {
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("127.0.0.1").allowed).toBe(true);
    expect(limiter.check("127.0.0.1").allowed).toBe(true);
    expect(limiter.check("127.0.0.1").allowed).toBe(false);
  });
});

describe("public articles routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/v1/public/articles", () => {
    it("returns serialized summaries with pagination", async () => {
      const articleResponse = {
        title: "Article",
        slug: "Article",
        canonicalPath: "/post",
        excerpt: "Summary",
        category: "Guides",
        tags: ["seo"],
        readingTime: 3,
        publishedAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      };

      vi.spyOn(articleModule, "getPublishedPublicArticles").mockResolvedValue({
        articles: [articleResponse],
        hasMore: false,
      });
      vi.spyOn(articleModule, "serializePublicArticleSummary").mockReturnValue({
        title: articleResponse.title,
        slug: articleResponse.slug,
        url: "https://supportsheep.com/post",
        excerpt: articleResponse.excerpt,
        category: articleResponse.category,
        tags: articleResponse.tags,
        publishedAt: articleResponse.publishedAt,
        updatedAt: articleResponse.updatedAt,
        readingTime: articleResponse.readingTime,
      });
      vi.spyOn(siteModule, "resolvePublicSiteUrl").mockReturnValue(
        "https://supportsheep.com",
      );

      const request = new Request(
        "https://supportsheep.com/api/v1/public/articles?page=1&limit=20",
      );
      const response = await listArticles(request as never);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.pagination).toEqual({
        page: 1,
        limit: 20,
        count: 1,
        hasMore: false,
      });
      expect(json.data[0]).not.toHaveProperty("draftBody");
      expect(json.data[0].url).toContain("https://supportsheep.com");
      expect(response.headers.get("cache-control")).toContain("max-age=300");
    });
  });

  describe("GET /api/v1/public/articles/:slug", () => {
    it("returns the detail payload for published articles", async () => {
      const article = {
        title: "Article",
        slug: "Article",
        canonicalPath: "/post",
        excerpt: "Summary",
        body: "<p>Published body</p>",
        category: "Guides",
        tags: ["seo"],
        author: "Supportsheep",
        readingTime: 3,
        publishedAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
        metaTitle: "Meta",
        metaDescription: "Desc",
      };

      vi.spyOn(
        articleModule,
        "getPublishedPublicArticleBySlug",
      ).mockResolvedValue(article);
      vi.spyOn(articleModule, "serializePublicArticleDetail").mockReturnValue({
        ...article,
        url: "https://supportsheep.com/post",
      });
      vi.spyOn(siteModule, "resolvePublicSiteUrl").mockReturnValue(
        "https://supportsheep.com",
      );

      const request = new Request(
        "https://supportsheep.com/api/v1/public/articles/post",
      );
      const response = await getArticleBySlug(
        request as never,
        {
          params: Promise.resolve({ slug: "Article" }),
        } as never,
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.body).toBe("<p>Published body</p>");
      expect(json.data).not.toHaveProperty("versions");
    });
  });
});
