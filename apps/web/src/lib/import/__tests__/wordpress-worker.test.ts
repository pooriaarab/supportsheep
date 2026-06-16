/**
 * Tests for the importWordPressPosts worker function.
 *
 * The R2 media bucket is mocked — only the rehosting path is exercised.
 * All D1 repos (imports, articles, media, categories) are mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Imports-repo mock
// ---------------------------------------------------------------------------

const mockGetImport = vi.hoisted(() => vi.fn());
const mockUpdateImport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import/imports-repository", () => ({
  getImport: mockGetImport,
  updateImport: mockUpdateImport,
}));

// ---------------------------------------------------------------------------
// Articles repo mock
// ---------------------------------------------------------------------------

const mockGetArticleByWordPressPostId = vi.hoisted(() => vi.fn());
const mockGetArticleBySlug = vi.hoisted(() => vi.fn());
const mockUpsertArticleForImport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/articles/repository", () => ({
  getArticleByWordPressPostId: mockGetArticleByWordPressPostId,
  getArticleBySlug: mockGetArticleBySlug,
  upsertArticleForImport: mockUpsertArticleForImport,
}));

// ---------------------------------------------------------------------------
// Media repo mock
// ---------------------------------------------------------------------------

const mockCreateMedia = vi.hoisted(() => vi.fn());

vi.mock("@/lib/media/repository", () => ({
  createMedia: mockCreateMedia,
}));

// ---------------------------------------------------------------------------
// Categories repo mock
// ---------------------------------------------------------------------------

const mockListCategories = vi.hoisted(() => vi.fn());
const mockCreateCategory = vi.hoisted(() => vi.fn());

vi.mock("@/lib/categories/repository", () => ({
  listCategories: mockListCategories,
  createCategory: mockCreateCategory,
}));

// ---------------------------------------------------------------------------
// R2 media bucket mock (getMediaBucket throws by default → no bucket)
// ---------------------------------------------------------------------------

const mockBucketPut = vi.hoisted(() => vi.fn());
const mockGetMediaBucket = vi.hoisted(() => vi.fn());

vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: mockGetMediaBucket,
}));

// ---------------------------------------------------------------------------
// Blog config + SEO + permalinks (lightweight stubs)
// ---------------------------------------------------------------------------

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: vi.fn().mockResolvedValue({
    blogId: "default",
    title: "Test Blog",
    permalink: { style: "slug-only" },
  }),
}));

vi.mock("@/lib/permalinks", () => ({
  getPermalinkSettings: vi.fn().mockReturnValue({ style: "slug-only" }),
  buildArticlePaths: vi.fn().mockImplementation(({ slug }: { slug: string }) => ({
    canonicalPath: `/${slug}`,
    legacyPaths: [],
  })),
}));

vi.mock("@/lib/seo/scoring", () => ({
  calculateSeoScore: vi.fn().mockReturnValue({ total: 80 }),
}));

vi.mock("@/lib/sanitize/article-html", () => ({
  sanitizeArticleHtml: vi.fn().mockImplementation((html: string) => html),
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { importWordPressPosts } from "@/lib/import/wordpress";
import type { WordPressPost } from "@/lib/import/wordpress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<WordPressPost> = {}): WordPressPost {
  return {
    wordpressPostId: "wp-1",
    sourceUrl: "https://example.com/hello-world/",
    sourcePath: "/hello-world/",
    title: "Hello World",
    slug: "hello-world",
    body: "<p>Body content here</p>",
    excerpt: "Short excerpt",
    categories: ["news"],
    tags: ["tag1"],
    featuredImage: "",
    publishDate: "2025-01-15 10:00:00",
    modifiedDate: "2025-01-20 10:00:00",
    status: "published",
    author: "admin",
    focusKeyword: "hello",
    metaTitle: "Hello World - Test Blog",
    metaDescription: "A test post about hello world",
    ...overrides,
  };
}

function makeImportJob(overrides = {}) {
  return {
    id: "import-1",
    blogId: "default",
    source: "wordpress",
    status: "running",
    totalPosts: 1,
    importedPosts: 0,
    rehostedImages: 0,
    failedPosts: [],
    createdBy: "user-1",
    startedAt: Date.now(),
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("importWordPressPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default: no cancelled import, no existing articles
    mockGetImport.mockResolvedValue(makeImportJob());
    mockGetArticleByWordPressPostId.mockResolvedValue(null);
    mockGetArticleBySlug.mockResolvedValue(null);
    mockUpsertArticleForImport.mockResolvedValue({ id: "new-article", slug: "hello-world" });
    mockCreateMedia.mockResolvedValue({ id: "media-1" });
    mockListCategories.mockResolvedValue([]);
    mockCreateCategory.mockResolvedValue({ ok: true, entry: { slug: "news" } });
    mockUpdateImport.mockResolvedValue(makeImportJob({ status: "completed" }));
    // No bucket by default: getMediaBucket throws (binding unconfigured),
    // which rehostImage's try/catch turns into a non-fatal skip.
    mockBucketPut.mockResolvedValue(undefined);
    mockGetMediaBucket.mockImplementation(() => {
      throw new Error("R2 MEDIA binding is not configured for this environment");
    });
  });

  describe("article create vs update routing", () => {
    it("creates a new article when no match by wpid or slug", async () => {
      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpsertArticleForImport).toHaveBeenCalledWith(
        "default",
        null, // create
        expect.objectContaining({ slug: "hello-world", wordpressPostId: "wp-1" }),
      );
    });

    it("updates by wpid when existing article found by wordpress post id", async () => {
      mockGetArticleByWordPressPostId.mockResolvedValue({
        id: "existing-id",
        slug: "hello-world",
        wordpressPostId: "wp-1",
      });

      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpsertArticleForImport).toHaveBeenCalledWith(
        "default",
        "existing-id", // update
        expect.objectContaining({ slug: "hello-world" }),
      );
    });

    it("updates by slug when no wpid match but slug exists without a wpid", async () => {
      mockGetArticleByWordPressPostId.mockResolvedValue(null);
      mockGetArticleBySlug.mockResolvedValue({
        id: "slug-existing",
        slug: "hello-world",
        wordpressPostId: null,
      });

      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpsertArticleForImport).toHaveBeenCalledWith(
        "default",
        "slug-existing", // update
        expect.objectContaining({ slug: "hello-world" }),
      );
    });

    it("accumulates failed posts when slug is already linked to another WP post", async () => {
      mockGetArticleByWordPressPostId.mockResolvedValue(null);
      mockGetArticleBySlug.mockResolvedValue({
        id: "conflict-id",
        slug: "hello-world",
        wordpressPostId: "wp-999", // different wpid → conflict
      });

      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      // Final update should have failedPosts with the conflict error
      expect(mockUpdateImport).toHaveBeenLastCalledWith(
        "default",
        "import-1",
        expect.objectContaining({
          failedPosts: expect.arrayContaining([
            expect.objectContaining({
              slug: "hello-world",
              error: expect.stringContaining("already linked"),
            }),
          ]),
        }),
      );
    });
  });

  describe("import status transitions", () => {
    it("marks import as completed when all posts succeed", async () => {
      const posts = [makePost({ slug: "a" }), makePost({ slug: "b", wordpressPostId: "wp-2" })];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpdateImport).toHaveBeenLastCalledWith(
        "default",
        "import-1",
        expect.objectContaining({
          status: "completed",
          importedPosts: 2,
        }),
      );
    });

    it("marks import as failed when all posts fail", async () => {
      mockUpsertArticleForImport.mockRejectedValue(new Error("db error"));
      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpdateImport).toHaveBeenLastCalledWith(
        "default",
        "import-1",
        expect.objectContaining({
          status: "failed",
          importedPosts: 0,
          failedPosts: expect.arrayContaining([
            expect.objectContaining({ slug: "hello-world", error: "db error" }),
          ]),
        }),
      );
    });

    it("marks import as completed with partial failures when some posts fail", async () => {
      const posts = [
        makePost({ slug: "good", wordpressPostId: "wp-1" }),
        makePost({ slug: "bad", wordpressPostId: "wp-2" }),
      ];
      let callCount = 0;
      mockUpsertArticleForImport.mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error("fail");
        return Promise.resolve({ id: `art-${callCount}`, slug: "good" });
      });

      await importWordPressPosts(posts, "import-1", "default");

      expect(mockUpdateImport).toHaveBeenLastCalledWith(
        "default",
        "import-1",
        expect.objectContaining({
          status: "completed", // not all failed
          importedPosts: 1,
          failedPosts: expect.arrayContaining([
            expect.objectContaining({ slug: "bad" }),
          ]),
        }),
      );
    });

    it("stops processing when import is cancelled (status=failed)", async () => {
      mockGetImport
        .mockResolvedValueOnce(makeImportJob({ status: "failed" })); // first post cancelled

      const posts = [makePost()];
      await importWordPressPosts(posts, "import-1", "default");

      // Worker stopped — upsert never called
      expect(mockUpsertArticleForImport).not.toHaveBeenCalled();
    });
  });

  describe("dates as ISO-8601 strings", () => {
    it("converts WordPress date strings to ISO-8601 for createdAt/updatedAt", async () => {
      const posts = [makePost({ publishDate: "2025-03-10 12:00:00", modifiedDate: "2025-03-11 08:30:00" })];
      await importWordPressPosts(posts, "import-1", "default");

      const articleArg = mockUpsertArticleForImport.mock.calls[0][2];
      expect(articleArg.createdAt).toBe("2025-03-10T12:00:00.000Z");
      expect(articleArg.updatedAt).toBe("2025-03-11T08:30:00.000Z");
    });

    it("sets publishedAt to ISO string for Published Articles", async () => {
      const posts = [makePost({ status: "published", publishDate: "2025-06-01 09:00:00" })];
      await importWordPressPosts(posts, "import-1", "default");

      const articleArg = mockUpsertArticleForImport.mock.calls[0][2];
      expect(articleArg.publishedAt).toBe("2025-06-01T09:00:00.000Z");
      expect(typeof articleArg.publishedAt).toBe("string");
    });

    it("sets publishedAt to null for Draft Articles", async () => {
      const posts = [makePost({ status: "draft" })];
      await importWordPressPosts(posts, "import-1", "default");

      const articleArg = mockUpsertArticleForImport.mock.calls[0][2];
      expect(articleArg.publishedAt).toBeNull();
    });

    it("falls back to ISO string now() when date is unparseable", async () => {
      const posts = [makePost({ publishDate: "not-a-date", modifiedDate: "also-bad" })];
      await importWordPressPosts(posts, "import-1", "default");

      const articleArg = mockUpsertArticleForImport.mock.calls[0][2];
      // Should be a valid ISO date string falling back to now
      expect(typeof articleArg.createdAt).toBe("string");
      expect(new Date(articleArg.createdAt).getTime()).not.toBeNaN();
    });
  });

  describe("progress update every 5 posts", () => {
    it("sends a progress update after every 5th processed post", async () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({ slug: `post-${i}`, wordpressPostId: `wp-${i}` }),
      );

      await importWordPressPosts(posts, "import-1", "default");

      // 5 and 10 should trigger progress updates; final update is the last call
      const progressCalls = mockUpdateImport.mock.calls.filter(
        (c) => c[2].status === undefined,
      );
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("categories via D1 repo", () => {
    it("creates missing categories before importing posts", async () => {
      mockListCategories.mockResolvedValue([]); // nothing exists
      const posts = [makePost({ categories: ["Tech", "Science"] })];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockCreateCategory).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({ slug: "tech", displayName: "Tech" }),
      );
      expect(mockCreateCategory).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({ slug: "science", displayName: "Science" }),
      );
    });

    it("skips category creation when it already exists", async () => {
      mockListCategories.mockResolvedValue([{ slug: "news", displayName: "News", order: 0, icon: "", description: "", postCount: 0 }]);
      const posts = [makePost({ categories: ["news"] })];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockCreateCategory).not.toHaveBeenCalled();
    });

    it("handles duplicate category creation gracefully", async () => {
      mockListCategories.mockResolvedValue([]);
      mockCreateCategory.mockResolvedValue({ ok: false, reason: "duplicate" });

      const posts = [makePost({ categories: ["news"] })];
      // Should not throw
      await expect(
        importWordPressPosts(posts, "import-1", "default"),
      ).resolves.toBeUndefined();
    });
  });

  describe("image rehosting skipped when media bucket unavailable", () => {
    it("does not call createMedia when getMediaBucket throws (non-fatal)", async () => {
      mockGetMediaBucket.mockImplementation(() => {
        throw new Error("R2 MEDIA binding is not configured for this environment");
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("image/jpeg") },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as unknown as Response);

      const posts = [makePost({ featuredImage: "https://wp.example.com/img.jpg" })];
      // Import must still complete — rehosting failure is non-fatal.
      await expect(
        importWordPressPosts(posts, "import-1", "default"),
      ).resolves.toBeUndefined();

      expect(mockCreateMedia).not.toHaveBeenCalled();
      // Original external URL is preserved on the article.
      const articleArg = mockUpsertArticleForImport.mock.calls[0][2];
      expect(articleArg.featuredImage.url).toBe("https://wp.example.com/img.jpg");
    });
  });

  describe("rehosted images saved to D1 media repo", () => {
    it("calls createMedia with the served media URL when an image is rehosted", async () => {
      mockGetMediaBucket.mockReturnValue({ put: mockBucketPut });

      // Mock fetch for image download
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("image/jpeg") },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as unknown as Response);

      const posts = [makePost({ featuredImage: "https://old-host.com/img.jpg" })];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockBucketPut).toHaveBeenCalled();
      expect(mockCreateMedia).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          url: expect.stringMatching(/^\/api\/v1\/media\/file\/media\/imported\//),
          mimeType: "image/jpeg",
        }),
      );
    });

    it("persists the R2 object key (storagePath) to the media row", async () => {
      mockGetMediaBucket.mockReturnValue({ put: mockBucketPut });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("image/jpeg") },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as unknown as Response);

      const posts = [makePost({ featuredImage: "https://old-host.com/photo.jpg" })];
      await importWordPressPosts(posts, "import-1", "default");

      expect(mockCreateMedia).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          storagePath: expect.stringMatching(/^media\/imported\/\d+-photo\.jpg$/),
        }),
      );
      // storagePath must NOT be empty — it is the R2 object key.
      const call = mockCreateMedia.mock.calls[0][1];
      expect(call.storagePath).not.toBe("");
    });
  });
});
