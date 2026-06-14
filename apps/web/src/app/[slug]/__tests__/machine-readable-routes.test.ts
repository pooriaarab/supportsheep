import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicArticleBySlug: vi.fn(),
  getBlogConfig: vi.fn(),
  resolvePublicSiteUrl: vi.fn(() => "https://supportsheep.com"),
}));

vi.mock("@/lib/public-route-resolution", () => ({
  getPublicArticleBySlug: mocks.getPublicArticleBySlug,
}));

vi.mock("@/lib/public-site", () => ({
  resolvePublicSiteUrl: mocks.resolvePublicSiteUrl,
}));

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mocks.getBlogConfig,
}));

import { GET as getLlmsText } from "@/app/[slug]/llms.txt/route";
import { GET as getMarkdown } from "@/app/[slug]/md/route";
import { GET as getIndexNowKey } from "@/app/api/indexnow/[indexNowKey]/route";

const article = {
  id: "article-1",
  blogId: "default",
  title: "Ideas for Personal Websites",
  slug: "ideas-for-personal-websites",
  canonicalPath: "/ideas-for-personal-websites",
  body: "<p>Publish work and answer common questions.</p>",
  draftBody: "",
  excerpt: "A practical guide to planning a personal site.",
  status: "published" as const,
  scheduledAt: null,
  publishedAt: "2026-04-15T00:00:00.000Z",
  postType: "how_to" as const,
  category: "Guides",
  tags: ["seo", "personal branding"],
  author: "Supportsheep",
  featuredImage: { url: "", alt: "" },
  ogImage: "",
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  seoScore: 0,
  internalLinks: [],
  externalLinks: [],
  versions: [],
  generatedBy: "manual" as const,
  generationMeta: null,
  wordCount: 450,
  readingTime: 2,
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

describe("machine-readable article routes", () => {
  beforeEach(() => {
    mocks.getPublicArticleBySlug.mockReset();
    mocks.getBlogConfig.mockReset();
    mocks.resolvePublicSiteUrl.mockClear();
    mocks.resolvePublicSiteUrl.mockReturnValue("https://supportsheep.com");
  });

  it("serves markdown exports from the published article lookup", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue(article);

    const response = await getMarkdown(
      new Request("http://localhost/post.md"),
      {
        params: Promise.resolve({ slug: article.slug }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    // Host resolution falls back to DEFAULT_BLOG_ID when no request host is
    // available (these tests don't mock `next/headers`).
    expect(mocks.getPublicArticleBySlug).toHaveBeenCalledWith(
      article.slug,
      "default",
    );
    await expect(response.text()).resolves.toContain(
      "# Ideas for Personal Websites",
    );
  });

  it("serves llms text exports from the published article lookup", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue(article);

    const response = await getLlmsText(
      new Request("http://localhost/post.llms.txt"),
      {
        params: Promise.resolve({ slug: article.slug }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    expect(mocks.getPublicArticleBySlug).toHaveBeenCalledWith(
      article.slug,
      "default",
    );
    await expect(response.text()).resolves.toContain(
      "Title: Ideas for Personal Websites",
    );
  });

  it("returns 404 when the article lookup misses", async () => {
    mocks.getPublicArticleBySlug.mockResolvedValue(null);

    const response = await getMarkdown(
      new Request("http://localhost/post.md"),
      {
        params: Promise.resolve({ slug: "missing-post" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not Found");
  });

  it("serves the configured indexnow key as a plain text verification file", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      seo: {
        submissionProtocols: {
          indexNow: {
            enabled: true,
            apiKey: "abc123",
          },
        },
      },
    });

    const response = await getIndexNowKey(
      new Request("http://localhost/abc123.txt"),
      {
        params: Promise.resolve({ indexNowKey: "abc123" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("abc123");
  });

  it("returns 404 when the indexnow route params are missing", async () => {
    mocks.getBlogConfig.mockResolvedValue({
      seo: {
        submissionProtocols: {
          indexNow: {
            enabled: true,
            apiKey: "abc123",
          },
        },
      },
    });

    const response = await getIndexNowKey(
      new Request("http://localhost/abc123.txt"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not Found");
  });
});
