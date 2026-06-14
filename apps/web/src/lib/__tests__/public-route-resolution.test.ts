import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublishedArticlesByCategory: vi.fn(),
  listPublishedArticlesByAuthor: vi.fn(),
  getRelatedArticles: vi.fn(),
  getPublishedArticleBySlug: vi.fn(),
  listCategories: vi.fn(),
  getAuthor: vi.fn(),
  listAuthors: vi.fn(),
}));

vi.mock("@/lib/articles/repository", () => ({
  listPublishedArticlesByCategory: mocks.listPublishedArticlesByCategory,
  listPublishedArticlesByAuthor: mocks.listPublishedArticlesByAuthor,
  getRelatedArticles: mocks.getRelatedArticles,
  getPublishedArticleBySlug: mocks.getPublishedArticleBySlug,
  listPublishedArticles: vi.fn(),
}));

vi.mock("@/lib/categories/repository", () => ({
  listCategories: mocks.listCategories,
}));

vi.mock("@/lib/authors/repository", () => ({
  getAuthor: mocks.getAuthor,
  listAuthors: mocks.listAuthors,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

import {
  getPublicAuthorArticles,
  getPublicCategoryArticles,
  getPublicCategories,
  getPublicCategoryInfo,
  getPublicAuthorBySlug,
  getAllPublicAuthors,
  resolveLegacyBlogPath,
} from "@/lib/public-route-resolution";

describe("resolveLegacyBlogPath", () => {
  it("redirects legacy blog article paths to the root canonical path", () => {
    const result = resolveLegacyBlogPath({
      categorySegment: "guides",
      slugSegment: "ideas-for-personal-websites",
      article: {
        slug: "ideas-for-personal-websites",
        category: "guides",
        canonicalPath: "/ideas-for-personal-websites",
      },
    });

    expect(result).toEqual({
      kind: "article-redirect",
      destination: "/ideas-for-personal-websites",
    });
  });
});

describe("getPublicCategoryArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to listPublishedArticlesByCategory and returns its result", async () => {
    const mockResult = {
      articles: [
        { id: "article-1", slug: "guide-1", title: "Guide 1" },
        { id: "article-2", slug: "legacy-guide", title: "Legacy Guide" },
      ],
      hasMore: false,
      totalCount: 2,
    };
    mocks.listPublishedArticlesByCategory.mockResolvedValue(mockResult);

    const result = await getPublicCategoryArticles(
      { slug: "guides", displayName: "Guides" },
      1,
      5,
    );

    expect(result.articles).toEqual(mockResult.articles);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(mocks.listPublishedArticlesByCategory).toHaveBeenCalledWith(
      "default",
      {
        categorySlug: "guides",
        categoryDisplayName: "Guides",
        page: 1,
        perPage: 5,
      },
    );
  });

  it("paginates and reports hasMore correctly", async () => {
    mocks.listPublishedArticlesByCategory.mockResolvedValue({
      articles: [
        { id: "article-3", slug: "guide-3" },
        { id: "article-4", slug: "guide-4" },
      ],
      hasMore: false,
      totalCount: 4,
    });

    const result = await getPublicCategoryArticles(
      { slug: "guides", displayName: "Guides" },
      2,
      2,
    );

    expect(result.articles).toEqual([
      expect.objectContaining({ id: "article-3" }),
      expect.objectContaining({ id: "article-4" }),
    ]);
    expect(result.totalCount).toBe(4);
    expect(result.hasMore).toBe(false);
  });
});

describe("getPublicAuthorArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns articles from listPublishedArticlesByAuthor", async () => {
    const articles = [{ id: "a1", slug: "post-1" }];
    mocks.listPublishedArticlesByAuthor.mockResolvedValue(articles);

    const result = await getPublicAuthorArticles("pooria-arab");
    expect(result).toEqual(articles);
    expect(mocks.listPublishedArticlesByAuthor).toHaveBeenCalledWith(
      "default",
      "pooria-arab",
      50,
    );
  });

  it("returns empty array when the query throws", async () => {
    mocks.listPublishedArticlesByAuthor.mockRejectedValue(
      new Error("D1 error"),
    );
    await expect(getPublicAuthorArticles("pooria-arab")).resolves.toEqual([]);
  });
});

describe("getPublicCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns categories from listCategories", async () => {
    const cats = [
      { slug: "guides", displayName: "Guides", order: 0, icon: "", description: "", postCount: 5 },
    ];
    mocks.listCategories.mockResolvedValue(cats);

    const result = await getPublicCategories();
    expect(result).toEqual(cats);
  });

  it("returns empty array when listCategories throws", async () => {
    mocks.listCategories.mockRejectedValue(new Error("D1 error"));
    await expect(getPublicCategories()).resolves.toEqual([]);
  });
});

describe("getPublicCategoryInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the matching category entry by slug", async () => {
    const cats = [
      { slug: "guides", displayName: "Guides", order: 0, icon: "", description: "All guides", postCount: 5 },
      { slug: "news", displayName: "News", order: 1, icon: "", description: "", postCount: 3 },
    ];
    mocks.listCategories.mockResolvedValue(cats);

    const result = await getPublicCategoryInfo("guides");
    expect(result).toMatchObject({ slug: "guides", displayName: "Guides" });
  });

  it("returns null when slug not found", async () => {
    mocks.listCategories.mockResolvedValue([]);
    expect(await getPublicCategoryInfo("no-such")).toBeNull();
  });
});

describe("getPublicAuthorBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an Author-shaped object when found", async () => {
    mocks.getAuthor.mockResolvedValue({
      id: "pooria-arab",
      name: "Pooria Arab",
      jobTitle: "Engineer",
      bio: "A developer",
      avatarUrl: "https://example.com/avatar.jpg",
      email: "pooria@example.com",
      sameAs: ["https://twitter.com/pooria"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await getPublicAuthorBySlug("pooria-arab");
    expect(result).toMatchObject({ id: "pooria-arab", name: "Pooria Arab" });
  });

  it("returns null when author not found", async () => {
    mocks.getAuthor.mockResolvedValue(null);
    expect(await getPublicAuthorBySlug("unknown")).toBeNull();
  });
});

describe("getAllPublicAuthors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps AuthorEntry list to Author list", async () => {
    mocks.listAuthors.mockResolvedValue([
      {
        id: "pooria-arab",
        name: "Pooria Arab",
        jobTitle: "",
        bio: "",
        avatarUrl: "",
        email: "",
        sameAs: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const result = await getAllPublicAuthors();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pooria-arab");
    expect(result[0].name).toBe("Pooria Arab");
  });

  it("returns empty array when listAuthors throws", async () => {
    mocks.listAuthors.mockRejectedValue(new Error("D1 error"));
    await expect(getAllPublicAuthors()).resolves.toEqual([]);
  });
});
