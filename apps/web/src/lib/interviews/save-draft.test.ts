import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { saveDraft } from "./save-draft";

// Mock the logger to avoid polluting stdout
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

// Mock the writer-worker-registry
const mockGetWorker = vi.hoisted(() => vi.fn());
vi.mock("./writer-worker-registry", () => ({
  getWorker: mockGetWorker,
}));

// Mock D1 interviews repository (getInterview + updateInterview)
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockUpdateInterview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  updateInterview: mockUpdateInterview,
}));

// Mock D1 articles repository (slugExists + createArticle + getArticleBySlug)
const mockSlugExists = vi.hoisted(() => vi.fn());
const mockCreateArticle = vi.hoisted(() => vi.fn());
const mockGetArticleBySlug = vi.hoisted(() => vi.fn());
vi.mock("@/lib/articles/repository", () => ({
  slugExists: mockSlugExists,
  createArticle: mockCreateArticle,
  getArticleBySlug: mockGetArticleBySlug,
}));

// Mock DEFAULT_BLOG_ID (save-draft doesn't use create-api-handler, so no resolveTenantForUser needed)
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(),
}));

const MOCK_ARTICLE_ID = "mock-new-article-123";

function makeArticleResult(slug = "mock-slug") {
  return {
    ok: true as const,
    article: {
      id: MOCK_ARTICLE_ID,
      slug,
      blogId: "default",
      title: "test",
      body: "",
      draftBody: "",
      status: "draft" as const,
    },
  };
}

describe("saveDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: slug does not already exist
    mockSlugExists.mockResolvedValue(false);
    // Default: createArticle succeeds
    mockCreateArticle.mockResolvedValue(makeArticleResult());
    // Default: updateInterview succeeds
    mockUpdateInterview.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("Throws if interview not found", async () => {
    mockGetInterview.mockResolvedValue(null);

    await expect(saveDraft("non-existent")).rejects.toThrow("Interview non-existent not found");
  });

  test("Saves draft for admin/owner role with draft status and updates interview", async () => {
    mockGetInterview.mockResolvedValue({
      id: "int-admin",
      blogId: "default",
      topic: "Admin Interview",
      startedByUid: "admin-uid",
      startedByRole: "admin",
      canvasSnapshot: null,
      guestName: null,
      guestEmail: null,
    });

    const mockWorker = {
      getCanvas: () => ({
        title: "Admin Interview Title",
        sections: [
          {
            id: "section-1",
            heading: "Intro",
            bullets: ["Bullet 1 & Bullet 2"],
            paragraphs: ["Paragraph 1 <script>alert(1)</script>"],
            quotes: [{ text: 'Quote "1"', attributedTo: "Guest" }],
            finalized: true,
          },
        ],
        meta: { description: "SEO description", tags: ["tech"], suggestedCategory: "Category" },
      }),
    };
    mockGetWorker.mockReturnValue(mockWorker);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) => {
      return Promise.resolve({
        ok: true as const,
        article: {
          id: MOCK_ARTICLE_ID,
          slug: articleDoc.slug ?? "admin-interview-title",
          blogId: "default",
          ...articleDoc,
        },
      });
    });

    const result = await saveDraft("int-admin");

    expect(result).toEqual({
      articleId: MOCK_ARTICLE_ID,
      slug: expect.any(String),
      requiresReview: false,
    });

    // Verify createArticle received the correct fields
    expect(mockCreateArticle).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        title: "Admin Interview Title",
        status: "draft",
        generatedBy: "interview",
        interviewId: "int-admin",
      }),
    );

    const articleArg = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;

    // HTML rendering
    expect(articleArg.body).toContain("<h1>Admin Interview Title</h1>");
    expect(articleArg.body).toContain("<h2>Intro</h2>");
    expect(articleArg.body).toContain("<li>Bullet 1 &amp; Bullet 2</li>");
    // Verify script tags are stripped or escaped
    expect(articleArg.body).not.toContain("<script>");
    expect(articleArg.body).toContain("Paragraph 1 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(articleArg.body).toContain('Quote "1"');
    expect(articleArg.body).toContain("<p>— Guest</p>");

    // Interview updated with direct publish
    expect(mockUpdateInterview).toHaveBeenCalledWith(
      "default",
      "int-admin",
      expect.objectContaining({
        articleId: MOCK_ARTICLE_ID,
        publishedDirect: true,
      }),
    );
  });

  test("Regression: writes article doc without undefined fields when canvas has no category", async () => {
    // Reproduces the Wave 8 walkthrough bug: the canvas did not set a
    // primaryCategory (or other optional fields). The document handed to
    // createArticle must omit `primaryCategory` rather than carry undefined.
    mockGetInterview.mockResolvedValue({
      id: "int-no-cat",
      blogId: "default",
      topic: "Untitled topic",
      startedByRole: "owner",
      canvasSnapshot: null,
      guestName: null,
      guestEmail: null,
    });

    const mockWorker = {
      getCanvas: () => ({
        title: "Draft Without Category",
        sections: [],
        meta: { description: null, tags: [], suggestedCategory: null },
        // Note: no `categories` field on the canvas
      }),
    };
    mockGetWorker.mockReturnValue(mockWorker);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: "draft-without-category", blogId: "default", ...articleDoc },
      }),
    );

    await expect(saveDraft("int-no-cat")).resolves.toMatchObject({
      articleId: MOCK_ARTICLE_ID,
    });

    expect(mockCreateArticle).toHaveBeenCalledTimes(1);
    const writtenDoc = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;

    // The document must NOT include any undefined values
    for (const [key, value] of Object.entries(writtenDoc)) {
      expect(value, `field "${key}" must not be undefined`).not.toBeUndefined();
    }

    expect(writtenDoc).not.toHaveProperty("primaryCategory");
    expect(writtenDoc).not.toHaveProperty("categories");
    expect(writtenDoc).not.toHaveProperty("authorId");
    expect(writtenDoc).not.toHaveProperty("source");
  });

  test("Preserves defined optional fields when present on the article doc", async () => {
    mockGetInterview.mockResolvedValue({
      id: "int-with-cat",
      blogId: "default",
      topic: "Topic With Category",
      startedByRole: "owner",
      canvasSnapshot: null,
      guestName: null,
      guestEmail: null,
    });

    mockGetWorker.mockReturnValue({
      getCanvas: () => ({
        title: "Draft With Category",
        sections: [],
        meta: { description: null, tags: [], suggestedCategory: null },
      }),
    });
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: "draft-with-category", blogId: "default", ...articleDoc },
      }),
    );

    await saveDraft("int-with-cat");

    const writtenDoc = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;
    expect(writtenDoc).toHaveProperty("title", "Draft With Category");
    expect(writtenDoc).toHaveProperty("status", "draft");
    expect(writtenDoc).toHaveProperty("category", "");
    expect(writtenDoc).toHaveProperty("scheduledAt", null);
  });

  test("Falls back to interview canvasSnapshot when no in-memory worker exists (cross-instance recovery)", async () => {
    mockGetInterview.mockResolvedValue({
      id: "int-cross-instance",
      blogId: "default",
      topic: "Cross-instance Interview",
      startedByRole: "owner",
      canvasSnapshot: {
        title: "Recovered Title",
        sections: [
          {
            id: "s-1",
            heading: "Recovered Section",
            bullets: ["Recovered bullet"],
            paragraphs: ["Recovered paragraph."],
            quotes: [],
            finalized: true,
          },
        ],
        meta: { description: null, tags: [], suggestedCategory: null },
      },
      guestName: null,
      guestEmail: null,
    });

    // No active worker on this lambda
    mockGetWorker.mockReturnValue(null);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: "recovered-title", blogId: "default", ...articleDoc },
      }),
    );

    await saveDraft("int-cross-instance");

    const writtenDoc = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;
    expect(writtenDoc.title).toBe("Recovered Title");
    expect(writtenDoc.body).toContain("<h1>Recovered Title</h1>");
    expect(writtenDoc.body).toContain("<h2>Recovered Section</h2>");
    expect(writtenDoc.body).toContain("<li>Recovered bullet</li>");
    expect(writtenDoc.body).toContain("<p>Recovered paragraph.</p>");
  });

  test("W20b integration: realtime tool batch (set_title + insert_section + insert_paragraph) → end → review renders paragraph body", async () => {
    const { WriterWorker } = await import("./writer-worker");
    const worker = new WriterWorker({
      interviewId: "int-w20b",
      apiKey: "test-key",
      client: {} as never,
    });

    worker.applyToolCall("set_title", { title: "Solo Grow: What It Means to Build on Your Own" });
    worker.applyToolCall("insert_section", { heading: "On Building Supportsheep" });
    const insertResult = worker.insertParagraph({
      sectionId: "section-1",
      text: "Building supportsheep means owning every part of the product — and that ownership compounds.",
    });
    expect(insertResult.ok).toBe(true);

    const canvasFromWorker = worker.getCanvas();
    expect(canvasFromWorker.title).toBe("Solo Grow: What It Means to Build on Your Own");
    expect(canvasFromWorker.sections).toHaveLength(1);
    expect(canvasFromWorker.sections[0].paragraphs).toContain(
      "Building supportsheep means owning every part of the product — and that ownership compounds.",
    );

    mockGetInterview.mockResolvedValue({
      id: "int-w20b",
      blogId: "default",
      topic: "what is supportsheep grow",
      startedByRole: "guest",
      guestName: "Pooria",
      guestEmail: "p@example.com",
      canvasSnapshot: canvasFromWorker,
    });
    mockGetWorker.mockReturnValue(null);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: "supportsheep-grow", blogId: "default", ...articleDoc },
      }),
    );

    const result = await saveDraft("int-w20b");
    expect(result.articleId).toBe(MOCK_ARTICLE_ID);

    const writtenDoc = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;
    expect(writtenDoc.title).toBe("Solo Grow: What It Means to Build on Your Own");
    expect(writtenDoc.body).toContain("Building supportsheep means owning every part of the product");
    expect(writtenDoc.body).toContain("<h2>On Building Supportsheep</h2>");
    expect(writtenDoc.body).toContain("<h1>Solo Grow: What It Means to Build on Your Own</h1>");
    expect(writtenDoc.draftBody).toEqual(writtenDoc.body);
  });

  test("Saves draft for author/guest role with pending_review status and attaches guest attribution", async () => {
    mockGetInterview.mockResolvedValue({
      id: "int-guest",
      blogId: "default",
      topic: "Guest Interview",
      startedByRole: "guest",
      guestName: "John Doe",
      guestEmail: "john@example.com",
      canvasSnapshot: null,
    });

    mockGetWorker.mockReturnValue(null);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: "guest-interview", blogId: "default", ...articleDoc },
      }),
    );

    const result = await saveDraft("int-guest");

    expect(result).toEqual({
      articleId: MOCK_ARTICLE_ID,
      slug: expect.any(String),
      requiresReview: true,
    });

    expect(mockCreateArticle).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        title: "Guest Interview",
        status: "pending_review",
        generatedBy: "interview",
        interviewId: "int-guest",
        guestAttribution: {
          name: "John Doe",
          email: "john@example.com",
        },
        body: "", // empty because no worker
      }),
    );

    expect(mockUpdateInterview).toHaveBeenCalledWith(
      "default",
      "int-guest",
      expect.objectContaining({
        articleId: MOCK_ARTICLE_ID,
        publishedDirect: false,
      }),
    );
  });

  test("W21G integration: full canvas (subtitle + featured image + sections with callouts/lists/code/inline image/table) round-trips into article body", async () => {
    const fullCanvas = {
      title: "What Is Solo Grow?",
      subtitle: "A short guide to building alone, without losing momentum.",
      slug: "what-is-supportsheep-grow",
      metaTitle: "What Is Solo Grow? — A Guide",
      metaDescription: "Definition, core idea, and how to start.",
      keywords: ["supportsheep", "grow", "indie"],
      tags: ["supportsheep", "grow"],
      categories: ["product"],
      featuredImage: {
        id: "img-hero",
        url: "https://images.example.com/hero.jpg",
        alt: "Hero image",
        placement: { kind: "featured" },
      },
      sections: [
        {
          id: "section-1",
          heading: "Definition and core idea",
          level: 2,
          bullets: [],
          paragraphs: [
            "Solo Grow is the practice of compounding small wins while building alone.",
          ],
          quotes: [
            {
              text: "If you can't ship today, ship something smaller tomorrow.",
              attributedTo: "solo founder",
            },
          ],
          blocks: [
            {
              id: "block-callout-1",
              type: "callout",
              kind: "info",
              title: "Why this matters",
              body: "Velocity compounds. Direction compounds harder.",
            },
            {
              id: "block-code-1",
              type: "code_block",
              language: "ts",
              code: "const ship = () => 'tomorrow';",
            },
            { id: "block-divider-1", type: "divider" },
            {
              id: "block-table-1",
              type: "table",
              rows: 1,
              cols: 2,
              headers: ["Day", "Win"],
            },
            {
              id: "block-embed-1",
              type: "embed",
              kind: "youtube",
              src: "https://www.youtube.com/embed/abc",
            },
          ],
          lists: [
            {
              id: "list-1",
              kind: "numbered",
              items: [
                { id: "list-1-item-1", text: "Pick one tiny goal", level: 0 },
                { id: "list-1-item-2", text: "Ship it before noon", level: 0 },
              ],
            },
            {
              id: "list-2",
              kind: "checklist",
              items: [
                {
                  id: "list-2-item-1",
                  text: "Brushed teeth",
                  level: 0,
                  checked: true,
                },
                {
                  id: "list-2-item-2",
                  text: "Sent the email",
                  level: 0,
                  checked: false,
                },
              ],
            },
          ],
          inlineImages: [
            {
              id: "img-inline-1",
              url: "https://images.example.com/inline.jpg",
              alt: "Inline diagram",
              placement: { kind: "inline", sectionId: "section-1" },
            },
          ],
          finalized: true,
        },
      ],
      meta: {
        description: "Definition, core idea, and how to start.",
        tags: ["supportsheep", "grow"],
        suggestedCategory: "product",
      },
    };

    mockGetInterview.mockResolvedValue({
      id: "int-w21g",
      blogId: "default",
      topic: "what is supportsheep grow",
      startedByRole: "guest",
      guestName: "Pooria",
      guestEmail: "p@example.com",
      canvasSnapshot: fullCanvas,
    });

    mockGetWorker.mockReturnValue(null);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: { id: MOCK_ARTICLE_ID, slug: articleDoc.slug ?? "what-is-supportsheep-grow", blogId: "default", ...articleDoc },
      }),
    );

    const result = await saveDraft("int-w21g");
    expect(result.articleId).toBe(MOCK_ARTICLE_ID);

    const writtenDoc = mockCreateArticle.mock.calls[0][1] as Record<string, unknown>;

    expect(writtenDoc.title).toBe("What Is Solo Grow?");
    expect(writtenDoc.body).toContain("<h1>What Is Solo Grow?</h1>");
    expect(writtenDoc.body).toContain(
      "A short guide to building alone, without losing momentum.",
    );
    expect(writtenDoc.body).toContain("https://images.example.com/hero.jpg");

    expect(writtenDoc.body).toContain("<h2>Definition and core idea</h2>");
    expect(writtenDoc.body).toContain(
      "Solo Grow is the practice of compounding small wins",
    );
    expect(writtenDoc.body).toContain("If you can't ship today");

    expect(writtenDoc.body).toContain('data-variant="info"');
    expect(writtenDoc.body).toContain("Velocity compounds. Direction compounds harder.");
    expect(writtenDoc.body).toContain('class="language-ts"');
    expect(writtenDoc.body).toContain("const ship = () =&gt;");
    expect(writtenDoc.body).toContain("tomorrow");
    expect(writtenDoc.body).toContain("<hr");
    expect(writtenDoc.body).toContain("<table");
    expect(writtenDoc.body).toContain("<th>Day</th>");
    expect(writtenDoc.body).toContain('data-kind="youtube"');

    expect(writtenDoc.body).toContain("<ol>");
    expect(writtenDoc.body).toContain("<li>Pick one tiny goal</li>");
    expect(writtenDoc.body).toContain('data-type="taskList"');
    expect(writtenDoc.body).toContain('data-checked="true"');

    expect(writtenDoc.body).toContain("https://images.example.com/inline.jpg");

    expect(writtenDoc.metaTitle).toBe("What Is Solo Grow? — A Guide");
    expect(writtenDoc.metaDescription).toBe(
      "Definition, core idea, and how to start.",
    );
    expect(writtenDoc.keywords).toEqual(["supportsheep", "grow", "indie"]);
    expect(writtenDoc.tags).toEqual(["supportsheep", "grow"]);
    expect(writtenDoc.categories).toEqual(["product"]);
    expect(writtenDoc.slug).toContain("what-is-supportsheep-grow");

    expect(writtenDoc.interviewCanvas).toMatchObject({
      title: "What Is Solo Grow?",
      sections: expect.any(Array),
    });
    expect(writtenDoc.draftBody).toEqual(writtenDoc.body);
  });
});
