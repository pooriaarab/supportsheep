import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import type { Article } from "@repo/types";
import {
  bulkDeleteArticles,
  createArticle,
  deleteArticleBySlug,
  getArticleBySlug,
  getArticleByWordPressPostId,
  getPublishedArticleBySlug,
  getRelatedArticles,
  listArticles,
  listPublishedArticles,
  listPublishedArticlesByAuthor,
  listPublishedArticlesByCategory,
  slugExists,
  submitArticleForReview,
  updateArticleBySlug,
  upsertArticleForImport,
} from "./repository";

type TestDb = Parameters<typeof listArticles>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE articles (
      id           text PRIMARY KEY NOT NULL,
      blog_id      text NOT NULL DEFAULT 'default',
      slug         text NOT NULL,
      status       text NOT NULL DEFAULT 'draft',
      category     text,
      primary_category text,
      post_type    text,
      author_id    text,
      published_at text,
      scheduled_at text,
      word_count   integer,
      created_at   text NOT NULL,
      updated_at   text NOT NULL,
      data         text NOT NULL
    );
  `);
  await client.execute(
    `CREATE UNIQUE INDEX articles_blog_slug_idx ON articles (blog_id, slug);`,
  );
  await client.execute(
    `CREATE INDEX articles_blog_status_idx ON articles (blog_id, status);`,
  );
  await client.execute(
    `CREATE INDEX articles_blog_updated_idx ON articles (blog_id, updated_at);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG = "default";

function makeArticle(overrides: Partial<Article> = {}): Article {
  const now = new Date().toISOString();
  return {
    blogId: BLOG,
    title: "Test Article",
    slug: "test-article",
    body: "<p>Hello world</p>",
    draftBody: "<p>Draft</p>",
    excerpt: "A test excerpt",
    summary: "",
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    postType: "blog_post",
    category: "tech",
    primaryCategory: "tech",
    categories: ["tech"],
    tags: ["tag1", "tag2"],
    author: "Jane Doe",
    authorId: "jane-doe",
    featuredImage: { url: "https://example.com/img.jpg", alt: "Test image", width: 1200, height: 630 },
    ogImage: "https://example.com/og.jpg",
    metaTitle: "Test Meta Title",
    metaDescription: "Test meta description",
    keywords: ["test", "article"],
    seoScore: 75,
    internalLinks: [{ anchor: "internal", url: "/about" }],
    externalLinks: [{ anchor: "external", url: "https://example.com" }],
    versions: [{ body: "<p>v1</p>", savedAt: now, note: "initial" }],
    generatedBy: "manual",
    guestAttribution: null,
    generationMeta: null,
    submissionStatus: { indexNow: { status: "pending", lastSubmittedAt: null, lastUrl: null, lastError: null } },
    wordCount: 2,
    readingTime: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("articles repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // listArticles
  // -------------------------------------------------------------------------

  it("returns empty array initially", async () => {
    const result = await listArticles(BLOG, { limit: 50 }, db);
    expect(result.articles).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns all articles for the knowledge base", async () => {
    await createArticle(BLOG, makeArticle({ slug: "article-a", title: "Article A" }), db);
    await createArticle(BLOG, makeArticle({ slug: "article-b", title: "Article B" }), db);

    const result = await listArticles(BLOG, { limit: 50 }, db);
    expect(result.articles).toHaveLength(2);
  });

  it("filters by status", async () => {
    await createArticle(BLOG, makeArticle({ slug: "draft-1", status: "draft" }), db);
    await createArticle(BLOG, makeArticle({ slug: "pub-1", status: "published" }), db);

    const drafts = await listArticles(BLOG, { limit: 50, status: "draft" }, db);
    expect(drafts.articles).toHaveLength(1);
    expect(drafts.articles[0].slug).toBe("draft-1");

    const published = await listArticles(BLOG, { limit: 50, status: "published" }, db);
    expect(published.articles).toHaveLength(1);
    expect(published.articles[0].slug).toBe("pub-1");
  });

  it("filters by category", async () => {
    await createArticle(BLOG, makeArticle({ slug: "tech-1", category: "tech" }), db);
    await createArticle(BLOG, makeArticle({ slug: "news-1", category: "news" }), db);

    const techArticles = await listArticles(BLOG, { limit: 50, category: "tech" }, db);
    expect(techArticles.articles).toHaveLength(1);
    expect(techArticles.articles[0].slug).toBe("tech-1");
  });

  it("filters by postType", async () => {
    await createArticle(BLOG, makeArticle({ slug: "blog-1", postType: "blog_post" }), db);
    await createArticle(BLOG, makeArticle({ slug: "how-to-1", postType: "how_to" }), db);

    const blogPosts = await listArticles(BLOG, { limit: 50, postType: "blog_post" }, db);
    expect(blogPosts.articles).toHaveLength(1);
    expect(blogPosts.articles[0].slug).toBe("blog-1");
  });

  it("applies client-side title search", async () => {
    await createArticle(BLOG, makeArticle({ slug: "hello-world", title: "Hello World" }), db);
    await createArticle(BLOG, makeArticle({ slug: "foo-bar", title: "Foo Bar" }), db);

    const result = await listArticles(BLOG, { limit: 50, search: "hello" }, db);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe("Hello World");
  });

  it("hasMore is true when exactly `limit` rows returned", async () => {
    for (let i = 0; i < 3; i++) {
      await createArticle(BLOG, makeArticle({ slug: `article-${i}`, title: `Article ${i}` }), db);
    }
    const result = await listArticles(BLOG, { limit: 3 }, db);
    expect(result.hasMore).toBe(true);
    expect(result.articles).toHaveLength(3);
  });

  it("hasMore is false when fewer than `limit` rows returned", async () => {
    for (let i = 0; i < 2; i++) {
      await createArticle(BLOG, makeArticle({ slug: `article-${i}`, title: `Article ${i}` }), db);
    }
    const result = await listArticles(BLOG, { limit: 3 }, db);
    expect(result.hasMore).toBe(false);
    expect(result.articles).toHaveLength(2);
  });

  it("respects tenant isolation (listArticles)", async () => {
    await createArticle(BLOG, makeArticle({ slug: "blog-a-article" }), db);
    await createArticle("blog-b", makeArticle({ slug: "blog-b-article", blogId: "blog-b" }), db);

    const resultA = await listArticles(BLOG, { limit: 50 }, db);
    const resultB = await listArticles("blog-b", { limit: 50 }, db);

    expect(resultA.articles).toHaveLength(1);
    expect(resultA.articles[0].slug).toBe("blog-a-article");
    expect(resultB.articles).toHaveLength(1);
    expect(resultB.articles[0].slug).toBe("blog-b-article");
  });

  // -------------------------------------------------------------------------
  // getArticleBySlug
  // -------------------------------------------------------------------------

  it("returns null for non-existent slug", async () => {
    expect(await getArticleBySlug(BLOG, "no-such-slug", db)).toBeNull();
  });

  it("returns article by slug with all fields round-tripped", async () => {
    const article = makeArticle();
    await createArticle(BLOG, article, db);

    const found = await getArticleBySlug(BLOG, "test-article", db);
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("test-article");
    expect(found!.title).toBe("Test Article");
    expect(found!.body).toBe("<p>Hello world</p>");
    expect(found!.draftBody).toBe("<p>Draft</p>");
    expect(found!.tags).toEqual(["tag1", "tag2"]);
    expect(found!.internalLinks).toEqual([{ anchor: "internal", url: "/about" }]);
    expect(found!.externalLinks).toEqual([{ anchor: "external", url: "https://example.com" }]);
    expect(found!.versions).toHaveLength(1);
    expect(found!.versions[0].body).toBe("<p>v1</p>");
    expect(found!.featuredImage.url).toBe("https://example.com/img.jpg");
    expect(found!.featuredImage.width).toBe(1200);
    expect(found!.submissionStatus?.indexNow?.status).toBe("pending");
    expect(found!.generationMeta).toBeNull();
    expect(typeof found!.id).toBe("string");
  });

  it("isolates by blogId (getArticleBySlug)", async () => {
    await createArticle(BLOG, makeArticle({ slug: "shared-slug" }), db);
    expect(await getArticleBySlug("other-blog", "shared-slug", db)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // createArticle
  // -------------------------------------------------------------------------

  it("creates an article and returns it with an id", async () => {
    const article = makeArticle();
    const result = await createArticle(BLOG, article, db);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.article.id).toBeDefined();
    expect(result.article.slug).toBe("test-article");
    expect(result.article.blogId).toBe(BLOG);
  });

  it("rejects duplicate slug within same blog", async () => {
    await createArticle(BLOG, makeArticle(), db);
    const result = await createArticle(BLOG, makeArticle({ title: "Different title" }), db);
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("allows same slug in different blogs", async () => {
    const a = await createArticle("blog-a", makeArticle({ blogId: "blog-a" }), db);
    const b = await createArticle("blog-b", makeArticle({ blogId: "blog-b" }), db);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // updateArticleBySlug
  // -------------------------------------------------------------------------

  it("updates article fields and bumps updatedAt", async () => {
    await createArticle(BLOG, makeArticle(), db);
    const before = await getArticleBySlug(BLOG, "test-article", db);

    const updated = await updateArticleBySlug(
      BLOG,
      "test-article",
      { title: "Updated Title", status: "published" },
      db,
    );
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Updated Title");
    expect(updated!.status).toBe("published");
    expect(updated!.body).toBe(before!.body); // unchanged

    // updatedAt should be >= original
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updatedAt).getTime(),
    );
  });

  it("returns null when updating non-existent slug", async () => {
    expect(await updateArticleBySlug(BLOG, "no-such-slug", { title: "x" }, db)).toBeNull();
  });

  it("preserves complex JSON fields after update (versions, links)", async () => {
    await createArticle(BLOG, makeArticle(), db);
    const now = new Date().toISOString();
    const newVersions = [
      { body: "<p>v1</p>", savedAt: now, note: "initial" },
      { body: "<p>v2</p>", savedAt: now, note: "second" },
    ];
    const updated = await updateArticleBySlug(
      BLOG,
      "test-article",
      { versions: newVersions },
      db,
    );
    expect(updated!.versions).toHaveLength(2);
    expect(updated!.versions[1].note).toBe("second");
    expect(updated!.internalLinks).toEqual([{ anchor: "internal", url: "/about" }]); // unchanged
  });

  // -------------------------------------------------------------------------
  // deleteArticleBySlug
  // -------------------------------------------------------------------------

  it("deletes an article and returns true", async () => {
    await createArticle(BLOG, makeArticle(), db);
    expect(await deleteArticleBySlug(BLOG, "test-article", db)).toBe(true);
    expect(await getArticleBySlug(BLOG, "test-article", db)).toBeNull();
  });

  it("returns false when deleting non-existent slug", async () => {
    expect(await deleteArticleBySlug(BLOG, "no-such-slug", db)).toBe(false);
  });

  it("delete is tenant-isolated", async () => {
    await createArticle("blog-a", makeArticle({ blogId: "blog-a", slug: "shared" }), db);
    await createArticle("blog-b", makeArticle({ blogId: "blog-b", slug: "shared" }), db);

    expect(await deleteArticleBySlug("blog-a", "shared", db)).toBe(true);
    expect(await getArticleBySlug("blog-a", "shared", db)).toBeNull();
    expect(await getArticleBySlug("blog-b", "shared", db)).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // submitArticleForReview
  // -------------------------------------------------------------------------

  it("transitions a draft article to pending_review", async () => {
    await createArticle(BLOG, makeArticle({ status: "draft" }), db);
    const result = await submitArticleForReview(BLOG, "test-article", db);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.article.status).toBe("pending_review");
  });

  it("returns wrong_status if article is not draft", async () => {
    await createArticle(BLOG, makeArticle({ status: "published" }), db);
    const result = await submitArticleForReview(BLOG, "test-article", db);
    expect(result).toEqual({ ok: false, reason: "wrong_status" });
  });

  it("returns not_found for unknown slug", async () => {
    const result = await submitArticleForReview(BLOG, "no-such-slug", db);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  // -------------------------------------------------------------------------
  // bulkDeleteArticles
  // -------------------------------------------------------------------------

  it("bulk deletes by slugs and returns count", async () => {
    await createArticle(BLOG, makeArticle({ slug: "a1" }), db);
    await createArticle(BLOG, makeArticle({ slug: "a2" }), db);
    await createArticle(BLOG, makeArticle({ slug: "a3" }), db);

    const count = await bulkDeleteArticles(BLOG, ["a1", "a2"], db);
    expect(count).toBe(2);

    const remaining = await listArticles(BLOG, { limit: 50 }, db);
    expect(remaining.articles).toHaveLength(1);
    expect(remaining.articles[0].slug).toBe("a3");
  });

  it("bulk delete ignores non-existent slugs", async () => {
    await createArticle(BLOG, makeArticle({ slug: "exists" }), db);
    const count = await bulkDeleteArticles(BLOG, ["exists", "no-such"], db);
    expect(count).toBe(1);
  });

  it("bulk delete is tenant-isolated", async () => {
    await createArticle("blog-a", makeArticle({ blogId: "blog-a", slug: "shared" }), db);
    await createArticle("blog-b", makeArticle({ blogId: "blog-b", slug: "shared" }), db);

    const count = await bulkDeleteArticles("blog-a", ["shared"], db);
    expect(count).toBe(1);

    // blog-b article should still exist
    expect(await getArticleBySlug("blog-b", "shared", db)).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // slugExists
  // -------------------------------------------------------------------------

  it("returns true when slug exists", async () => {
    await createArticle(BLOG, makeArticle(), db);
    expect(await slugExists(BLOG, "test-article", db)).toBe(true);
  });

  it("returns false when slug does not exist", async () => {
    expect(await slugExists(BLOG, "no-such-slug", db)).toBe(false);
  });

  it("slugExists is tenant-isolated", async () => {
    await createArticle("blog-a", makeArticle({ blogId: "blog-a" }), db);
    expect(await slugExists("blog-b", "test-article", db)).toBe(false);
  });
});

// =============================================================================
// Public read queries
// =============================================================================

describe("listPublishedArticles", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns only published articles", async () => {
    await createArticle(BLOG, makeArticle({ slug: "draft-1", status: "draft" }), db);
    await createArticle(BLOG, makeArticle({ slug: "pub-1", status: "published", publishedAt: "2026-04-01T00:00:00.000Z" }), db);

    const result = await listPublishedArticles(BLOG, { limit: 50 }, db);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].slug).toBe("pub-1");
  });

  it("orders published articles by publishedAt desc", async () => {
    await createArticle(BLOG, makeArticle({ slug: "older", status: "published", publishedAt: "2026-03-01T00:00:00.000Z" }), db);
    await createArticle(BLOG, makeArticle({ slug: "newer", status: "published", publishedAt: "2026-05-01T00:00:00.000Z" }), db);

    const result = await listPublishedArticles(BLOG, { limit: 50 }, db);
    expect(result.articles[0].slug).toBe("newer");
    expect(result.articles[1].slug).toBe("older");
  });

  it("filters by category (primaryCategory column)", async () => {
    await createArticle(BLOG, makeArticle({ slug: "pub-tech", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "tech" }), db);
    await createArticle(BLOG, makeArticle({ slug: "pub-news", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "news" }), db);

    const result = await listPublishedArticles(BLOG, { limit: 50, category: "tech" }, db);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].slug).toBe("pub-tech");
  });

  it("filters by tag (in-memory over the tags array)", async () => {
    await createArticle(BLOG, makeArticle({ slug: "pub-a", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", tags: ["seo", "ai"] }), db);
    await createArticle(BLOG, makeArticle({ slug: "pub-b", status: "published", publishedAt: "2026-04-02T00:00:00.000Z", tags: ["marketing"] }), db);
    await createArticle(BLOG, makeArticle({ slug: "draft-a", status: "draft", tags: ["seo"] }), db);

    const result = await listPublishedArticles(BLOG, { limit: 50, tag: "seo" }, db);
    expect(result.articles.map((a) => a.slug)).toEqual(["pub-a"]);
    // Non-matching tag → empty (NOT all articles — guards the silent no-op regression).
    expect((await listPublishedArticles(BLOG, { limit: 50, tag: "nope" }, db)).articles).toHaveLength(0);
  });

  it("reports hasMore=true when more rows exist beyond limit", async () => {
    for (let i = 0; i < 4; i++) {
      await createArticle(BLOG, makeArticle({ slug: `pub-${i}`, status: "published", publishedAt: `2026-04-0${i + 1}T00:00:00.000Z` }), db);
    }
    const result = await listPublishedArticles(BLOG, { limit: 3 }, db);
    expect(result.hasMore).toBe(true);
    expect(result.articles).toHaveLength(3);
  });

  it("supports offset pagination", async () => {
    for (let i = 0; i < 4; i++) {
      await createArticle(BLOG, makeArticle({ slug: `pub-${i}`, status: "published", publishedAt: `2026-04-0${i + 1}T00:00:00.000Z` }), db);
    }
    // Sorted desc: pub-3, pub-2, pub-1, pub-0. Offset 2 should return pub-1, pub-0
    const result = await listPublishedArticles(BLOG, { limit: 3, offset: 2 }, db);
    expect(result.articles[0].slug).toBe("pub-1");
    expect(result.articles[1].slug).toBe("pub-0");
  });

  it("is tenant-isolated", async () => {
    await createArticle(BLOG, makeArticle({ slug: "blog-a-pub", status: "published", publishedAt: "2026-04-01T00:00:00.000Z" }), db);
    await createArticle("blog-b", makeArticle({ slug: "blog-b-pub", blogId: "blog-b", status: "published", publishedAt: "2026-04-01T00:00:00.000Z" }), db);

    const resultA = await listPublishedArticles(BLOG, { limit: 50 }, db);
    const resultB = await listPublishedArticles("blog-b", { limit: 50 }, db);
    expect(resultA.articles).toHaveLength(1);
    expect(resultA.articles[0].slug).toBe("blog-a-pub");
    expect(resultB.articles).toHaveLength(1);
    expect(resultB.articles[0].slug).toBe("blog-b-pub");
  });
});

describe("getPublishedArticleBySlug", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns a published article by slug", async () => {
    await createArticle(BLOG, makeArticle({ slug: "my-post", status: "published", publishedAt: "2026-04-01T00:00:00.000Z" }), db);
    const result = await getPublishedArticleBySlug(BLOG, "my-post", db);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("my-post");
  });

  it("returns null for a draft article", async () => {
    await createArticle(BLOG, makeArticle({ slug: "draft-post", status: "draft" }), db);
    expect(await getPublishedArticleBySlug(BLOG, "draft-post", db)).toBeNull();
  });

  it("returns null for non-existent slug", async () => {
    expect(await getPublishedArticleBySlug(BLOG, "no-such", db)).toBeNull();
  });

  it("is tenant-isolated", async () => {
    await createArticle(BLOG, makeArticle({ slug: "shared", status: "published", publishedAt: "2026-04-01T00:00:00.000Z" }), db);
    expect(await getPublishedArticleBySlug("other-blog", "shared", db)).toBeNull();
  });
});

describe("getRelatedArticles", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns related articles by primaryCategory, excluding current", async () => {
    await createArticle(BLOG, makeArticle({ slug: "current", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "tech" }), db);
    await createArticle(BLOG, makeArticle({ slug: "related-1", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: "tech" }), db);
    await createArticle(BLOG, makeArticle({ slug: "unrelated", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: "news" }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", limit: 5 }, db);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("related-1");
  });

  it("excludes the current article slug", async () => {
    await createArticle(BLOG, makeArticle({ slug: "current", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "tech" }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", limit: 5 }, db);
    expect(result.map((a) => a.slug)).not.toContain("current");
  });

  it("falls back to legacy category when no primaryCategory match", async () => {
    await createArticle(BLOG, makeArticle({ slug: "legacy-article", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: undefined, category: "Guides" }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "guides", legacyCategory: "Guides", limit: 5 }, db);
    expect(result.some((a) => a.slug === "legacy-article")).toBe(true);
  });

  it("deduplicates articles that match both primaryCategory and legacy category", async () => {
    await createArticle(BLOG, makeArticle({ slug: "both-match", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: "tech", category: "tech" }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", legacyCategory: "tech", limit: 5 }, db);
    const ids = result.map((a) => a.slug);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it("fills remaining slots via shared secondary categories (categories[] overlap)", async () => {
    // No primaryCategory/legacy match for "tech", but "overlap" shares the "ai"
    // secondary category with the current article; "no-overlap" shares nothing.
    await createArticle(BLOG, makeArticle({ slug: "overlap", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: "news", categories: ["news", "ai"] }), db);
    await createArticle(BLOG, makeArticle({ slug: "no-overlap", status: "published", publishedAt: "2026-03-02T00:00:00.000Z", primaryCategory: "sports", categories: ["sports"] }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", categories: ["tech", "ai"], limit: 5 }, db);
    expect(result.map((a) => a.slug)).toContain("overlap");
    expect(result.map((a) => a.slug)).not.toContain("no-overlap");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createArticle(BLOG, makeArticle({ slug: `tech-${i}`, status: "published", publishedAt: `2026-0${i + 1}-01T00:00:00.000Z`, primaryCategory: "tech" }), db);
    }
    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", limit: 3 }, db);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns empty when no category provided", async () => {
    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", limit: 5 }, db);
    expect(result).toEqual([]);
  });

  it("is tenant-isolated", async () => {
    await createArticle("blog-b", makeArticle({ blogId: "blog-b", slug: "b-article", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: "tech" }), db);

    const result = await getRelatedArticles(BLOG, { excludeSlug: "current", category: "tech", limit: 5 }, db);
    expect(result.map((a) => a.slug)).not.toContain("b-article");
  });
});

describe("listPublishedArticlesByCategory", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("merges primaryCategory and legacy category results", async () => {
    await createArticle(BLOG, makeArticle({ slug: "primary-match", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "guides", category: "other" }), db);
    await createArticle(BLOG, makeArticle({ slug: "legacy-match", status: "published", publishedAt: "2026-03-01T00:00:00.000Z", primaryCategory: undefined, category: "Guides" }), db);
    await createArticle(BLOG, makeArticle({ slug: "no-match", status: "published", publishedAt: "2026-02-01T00:00:00.000Z", primaryCategory: "news", category: "News" }), db);

    const result = await listPublishedArticlesByCategory(
      BLOG,
      { categorySlug: "guides", categoryDisplayName: "Guides", page: 1, perPage: 10 },
      db,
    );

    const slugs = result.articles.map((a) => a.slug);
    expect(slugs).toContain("primary-match");
    expect(slugs).toContain("legacy-match");
    expect(slugs).not.toContain("no-match");
  });

  it("deduplicates articles matching both queries", async () => {
    await createArticle(BLOG, makeArticle({ slug: "both", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "guides", category: "Guides" }), db);

    const result = await listPublishedArticlesByCategory(
      BLOG,
      { categorySlug: "guides", categoryDisplayName: "Guides", page: 1, perPage: 10 },
      db,
    );
    expect(result.articles.filter((a) => a.slug === "both")).toHaveLength(1);
  });

  it("paginates correctly", async () => {
    for (let i = 0; i < 4; i++) {
      await createArticle(BLOG, makeArticle({ slug: `guide-${i}`, status: "published", publishedAt: `2026-0${i + 1}-01T00:00:00.000Z`, primaryCategory: "guides" }), db);
    }
    const page1 = await listPublishedArticlesByCategory(BLOG, { categorySlug: "guides", categoryDisplayName: "Guides", page: 1, perPage: 2 }, db);
    const page2 = await listPublishedArticlesByCategory(BLOG, { categorySlug: "guides", categoryDisplayName: "Guides", page: 2, perPage: 2 }, db);

    expect(page1.articles).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.totalCount).toBe(4);
    expect(page2.articles).toHaveLength(2);
    expect(page2.hasMore).toBe(false);
  });

  it("orders by publishedAt desc after merge", async () => {
    await createArticle(BLOG, makeArticle({ slug: "older-primary", status: "published", publishedAt: "2026-02-01T00:00:00.000Z", primaryCategory: "guides" }), db);
    await createArticle(BLOG, makeArticle({ slug: "newer-legacy", status: "published", publishedAt: "2026-05-01T00:00:00.000Z", primaryCategory: undefined, category: "Guides" }), db);

    const result = await listPublishedArticlesByCategory(BLOG, { categorySlug: "guides", categoryDisplayName: "Guides", page: 1, perPage: 10 }, db);
    expect(result.articles[0].slug).toBe("newer-legacy");
    expect(result.articles[1].slug).toBe("older-primary");
  });

  it("is tenant-isolated", async () => {
    await createArticle(BLOG, makeArticle({ slug: "a-guide", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "guides" }), db);
    await createArticle("blog-b", makeArticle({ blogId: "blog-b", slug: "b-guide", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", primaryCategory: "guides" }), db);

    const result = await listPublishedArticlesByCategory(BLOG, { categorySlug: "guides", categoryDisplayName: "Guides", page: 1, perPage: 10 }, db);
    expect(result.articles.map((a) => a.slug)).not.toContain("b-guide");
  });
});

describe("listPublishedArticlesByAuthor", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns published articles by authorId", async () => {
    await createArticle(BLOG, makeArticle({ slug: "pub-by-jane", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", authorId: "jane-doe" }), db);
    await createArticle(BLOG, makeArticle({ slug: "draft-by-jane", status: "draft", authorId: "jane-doe" }), db);
    await createArticle(BLOG, makeArticle({ slug: "pub-by-bob", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", authorId: "bob-smith" }), db);

    const result = await listPublishedArticlesByAuthor(BLOG, "jane-doe", 50, db);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("pub-by-jane");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createArticle(BLOG, makeArticle({ slug: `jane-post-${i}`, status: "published", publishedAt: `2026-0${i + 1}-01T00:00:00.000Z`, authorId: "jane-doe" }), db);
    }
    const result = await listPublishedArticlesByAuthor(BLOG, "jane-doe", 3, db);
    expect(result).toHaveLength(3);
  });

  it("is tenant-isolated", async () => {
    await createArticle("blog-b", makeArticle({ blogId: "blog-b", slug: "b-post", status: "published", publishedAt: "2026-04-01T00:00:00.000Z", authorId: "jane-doe" }), db);
    const result = await listPublishedArticlesByAuthor(BLOG, "jane-doe", 50, db);
    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // getArticleByWordPressPostId
  // -------------------------------------------------------------------------

  describe("getArticleByWordPressPostId", () => {
    it("finds an article by its wordpress post id", async () => {
      await createArticle(
        BLOG,
        makeArticle({ slug: "wp-post", wordpressPostId: "wp-42" }),
        db,
      );

      const found = await getArticleByWordPressPostId(BLOG, "wp-42", db);
      expect(found).not.toBeNull();
      expect(found?.slug).toBe("wp-post");
      expect(found?.wordpressPostId).toBe("wp-42");
    });

    it("returns null when no article matches the wpid", async () => {
      await createArticle(BLOG, makeArticle({ slug: "other", wordpressPostId: "wp-1" }), db);
      const found = await getArticleByWordPressPostId(BLOG, "wp-nonexistent", db);
      expect(found).toBeNull();
    });

    it("is blog-scoped — does not match across tenants", async () => {
      await createArticle(
        "blog-b",
        makeArticle({ blogId: "blog-b", slug: "b-wp", wordpressPostId: "wp-99" }),
        db,
      );
      const found = await getArticleByWordPressPostId(BLOG, "wp-99", db);
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // upsertArticleForImport
  // -------------------------------------------------------------------------

  describe("upsertArticleForImport", () => {
    it("creates a new article when targetId is null and slug is new", async () => {
      const article = makeArticle({ slug: "fresh-import", title: "Fresh", wordpressPostId: "wp-100" });
      const result = await upsertArticleForImport(BLOG, null, article, db);

      expect(result.id).toBeTruthy();
      expect(result.slug).toBe("fresh-import");

      const fetched = await getArticleBySlug(BLOG, "fresh-import", db);
      expect(fetched?.title).toBe("Fresh");
    });

    it("updates the row identified by targetId", async () => {
      const created = await createArticle(BLOG, makeArticle({ slug: "to-update", title: "Original" }), db);
      if (!created.ok) throw new Error("setup failed");

      const updated = await upsertArticleForImport(
        BLOG,
        created.article.id,
        makeArticle({ slug: "to-update", title: "Updated Title", wordpressPostId: "wp-7" }),
        db,
      );

      expect(updated.id).toBe(created.article.id);
      expect(updated.title).toBe("Updated Title");
      expect(updated.wordpressPostId).toBe("wp-7");

      // No duplicate row created
      const all = await listArticles(BLOG, { limit: 50 }, db);
      expect(all.articles).toHaveLength(1);
    });

    it("falls back to updating the existing row on duplicate slug when targetId is null", async () => {
      const created = await createArticle(BLOG, makeArticle({ slug: "dup-slug", title: "First" }), db);
      if (!created.ok) throw new Error("setup failed");

      // targetId null but slug already exists → should update, not throw or duplicate
      const result = await upsertArticleForImport(
        BLOG,
        null,
        makeArticle({ slug: "dup-slug", title: "Second", wordpressPostId: "wp-dup" }),
        db,
      );

      expect(result.id).toBe(created.article.id);
      expect(result.title).toBe("Second");
      expect(result.wordpressPostId).toBe("wp-dup");

      const all = await listArticles(BLOG, { limit: 50 }, db);
      expect(all.articles).toHaveLength(1);
    });
  });
});
