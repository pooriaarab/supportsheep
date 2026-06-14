import { describe, expect, it, vi } from "vitest";
import { preparePublishedArticleUpdate } from "@/lib/article-publish";

vi.mock("@/lib/seo/indexnow", () => ({
  resolveIndexNowSubmissionStatus: vi.fn(),
}));

const article = {
  slug: "my-post",
  category: "Guides",
  canonicalPath: "/my-post/",
  body: "<p>Published body</p>",
  draftBody: "<p>Draft body with enough words to count correctly.</p>",
  submissionStatus: undefined,
} as const;

const config = {
  seo: {
    submissionProtocols: {
      indexNow: {
        enabled: true,
        apiKey: "abc123",
      },
    },
  },
} as const;

describe("preparePublishedArticleUpdate", () => {
  it("prepares publish data and stores submitted indexnow status", async () => {
    const { resolveIndexNowSubmissionStatus } =
      await import("@/lib/seo/indexnow");
    vi.mocked(resolveIndexNowSubmissionStatus).mockResolvedValue({
      status: "submitted",
      lastSubmittedAt: "2026-04-22T00:00:00.000Z",
      lastUrl: "https://blogbat.com/my-post/",
      lastError: null,
    });

    const result = await preparePublishedArticleUpdate({
      article,
      config,
      siteUrl: "https://blogbat.com",
    });

    expect(result.body).toContain("Draft body");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.readingTime).toBe(1);
    expect(result.submissionStatus.indexNow).toMatchObject({
      status: "submitted",
      lastError: null,
    });
  });

  it("stores failed indexnow status without throwing", async () => {
    const { resolveIndexNowSubmissionStatus } =
      await import("@/lib/seo/indexnow");
    vi.mocked(resolveIndexNowSubmissionStatus).mockResolvedValue({
      status: "failed",
      lastSubmittedAt: null,
      lastUrl: "https://blogbat.com/my-post/",
      lastError: "IndexNow 400: bad request",
    });

    const result = await preparePublishedArticleUpdate({
      article,
      config,
      siteUrl: "https://blogbat.com",
    });

    expect(result.submissionStatus.indexNow).toMatchObject({
      status: "failed",
      lastError: expect.stringContaining("400"),
    });
  });
});
