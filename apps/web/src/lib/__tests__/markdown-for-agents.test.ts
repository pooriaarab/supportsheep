import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listPublishedArticles = vi.fn();

  return {
    listPublishedArticles,
    mockGetBlogConfig: vi.fn(),
    mockGetPublicArticleBySlug: vi.fn(),
    mockResolvePublicSiteUrl: vi.fn(),
  };
});

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mocks.mockGetBlogConfig,
}));

vi.mock("@/lib/articles/repository", () => ({
  listPublishedArticles: mocks.listPublishedArticles,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
}));

vi.mock("@/lib/public-route-resolution", () => ({
  getPublicArticleBySlug: mocks.mockGetPublicArticleBySlug,
  getPublicCategoryArticles: vi.fn(),
  getPublicCategoryInfo: vi.fn(),
  resolveCategorySlug: vi.fn(),
}));

vi.mock("@/lib/public-site", () => ({
  resolvePublicSiteUrl: mocks.mockResolvePublicSiteUrl,
}));

import {
  renderHomepageMarkdown,
  renderMarkdownForPath,
  resolveMarkdownRoute,
} from "@/lib/markdown-for-agents";

describe("markdown for agents", () => {
  beforeEach(() => {
    mocks.listPublishedArticles.mockReset();
    mocks.mockGetBlogConfig.mockReset();
    mocks.mockGetPublicArticleBySlug.mockReset();
    mocks.mockResolvePublicSiteUrl.mockReset();

    mocks.listPublishedArticles.mockResolvedValue({ articles: [], hasMore: false });
    mocks.mockGetBlogConfig.mockResolvedValue({
      siteName: "Blog",
      siteDescription: "A modern blog",
      homepage: { postsPerPage: 12 },
    });
    mocks.mockResolvePublicSiteUrl.mockReturnValue("https://supportsheep.com");
  });

  it("renders homepage content as markdown", () => {
    const markdown = renderHomepageMarkdown({
      siteName: "Blog",
      siteDescription: "A modern blog",
      articles: [
        {
          title: "Low Cost SEO Packages",
          url: "https://supportsheep.com/low-cost-seo-packages",
          excerpt: "A concise intro.",
        },
      ],
    });

    expect(markdown).toContain("# Blog");
    expect(markdown).toContain("## Low Cost SEO Packages");
    expect(markdown).toContain("https://supportsheep.com/low-cost-seo-packages");
  });

  it("resolves supported markdown routes by pathname", () => {
    expect(resolveMarkdownRoute("/")).toEqual({
      kind: "homepage",
      pathname: "/",
    });
    expect(resolveMarkdownRoute("/blog")).toEqual({
      kind: "blog-index",
      pathname: "/blog",
    });
    expect(resolveMarkdownRoute("/docs/")).toEqual({
      kind: "docs",
      pathname: "/docs",
    });
    expect(resolveMarkdownRoute("/category/seo")).toEqual({
      kind: "category",
      pathname: "/category/seo",
      categorySegment: "seo",
    });
    expect(resolveMarkdownRoute("/example-article")).toEqual({
      kind: "article",
      pathname: "/example-article",
      slug: "example-article",
    });
  });

  it("marks unsupported paths as unsupported routes", () => {
    expect(resolveMarkdownRoute("/contact")).toEqual({
      kind: "unsupported",
      pathname: "/contact",
    });
    expect(resolveMarkdownRoute("/category/seo/extra")).toEqual({
      kind: "unsupported",
      pathname: "/category/seo/extra",
    });
    expect(resolveMarkdownRoute("relative/path")).toEqual({
      kind: "unsupported",
      pathname: "relative/path",
    });
  });

  it("returns a markdown 404 for unsupported paths", async () => {
    const response = await renderMarkdownForPath(
      "/not-a-supported-markdown-route/deep",
      new URLSearchParams(),
    );

    expect(response.status).toBe(404);
    expect(response.markdown).toContain("# Not Found");
    expect(response.markdown).toContain("/not-a-supported-markdown-route/deep");
  });

  it("caps markdown homepage pagination to avoid expensive offsets", async () => {
    const response = await renderMarkdownForPath(
      "/",
      new URLSearchParams("page=10000"),
    );

    expect(response.status).toBe(200);
    expect(mocks.listPublishedArticles).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ offset: 1188 }),
    );
  });

  it("preserves double-encoded entities in article markdown", async () => {
    mocks.mockGetPublicArticleBySlug.mockResolvedValue({
      title: "Encoded Article",
      slug: "encoded-article",
      category: "Guides",
      canonicalPath: "/encoded-article",
      excerpt: "",
      body: "<p>&amp;lt;strong&amp;gt;safe&amp;lt;/strong&amp;gt; &quot;quoted&quot;</p>",
      publishedAt: "2026-04-15T00:00:00.000Z",
    });

    const response = await renderMarkdownForPath(
      "/encoded-article",
      new URLSearchParams(),
    );

    expect(response.status).toBe(200);
    expect(response.markdown).toContain(
      "&lt;strong&gt;safe&lt;/strong&gt; \"quoted\"",
    );
  });
});
