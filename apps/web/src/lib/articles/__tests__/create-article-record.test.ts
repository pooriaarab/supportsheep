import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";

describe("buildArticleCreateDocument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
  });

  it("builds a published article with source metadata and reading stats", async () => {
    const slugExists = vi.fn().mockResolvedValue(false);

    const result = await buildArticleCreateDocument(
      {
        title: "Webhook Post",
        body: "<p>Hello world from webhook</p>",
        excerpt: "Meta description",
        metaDescription: "Meta description",
        tags: ["seo"],
        status: "published",
        source: {
          kind: "webhook",
          integrationId: "integration-1",
          provider: "outrank",
          externalArticleId: "ext-1",
          receivedAt: "2026-04-23T12:00:00.000Z",
        },
      },
      slugExists,
    );

    expect(result.slug).toBe("webhook-post");
    expect(result.status).toBe("published");
    expect(result.publishedAt).toBe("2026-04-23T12:00:00.000Z");
    expect(result.source?.provider).toBe("outrank");
    expect(result.readingTime).toBeGreaterThanOrEqual(1);
    expect(result.submissionStatus?.indexNow?.status).toBe("not_configured");
  });

  it("adds a suffix when the base slug already exists", async () => {
    const slugExists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await buildArticleCreateDocument(
      {
        title: "Webhook Post",
        status: "draft",
      },
      slugExists,
    );

    expect(result.slug).toMatch(/^webhook-post-/);
    expect(result.publishedAt).toBeNull();
  });
});
