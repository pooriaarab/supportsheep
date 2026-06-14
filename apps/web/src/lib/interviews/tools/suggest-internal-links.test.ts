import { describe, expect, it, vi, beforeEach } from "vitest";

const mockListPublishedArticles = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    articles: [{ slug: "voice-ux-guide", title: "Voice UX guide" }],
    hasMore: false,
  }),
);

vi.mock("@/lib/articles/repository", () => ({
  listPublishedArticles: mockListPublishedArticles,
}));

import suggestInternalLinks from "./suggest-internal-links";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("suggest_internal_links tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPublishedArticles.mockResolvedValue({
      articles: [{ slug: "voice-ux-guide", title: "Voice UX guide" }],
      hasMore: false,
    });
  });

  it("acks immediately and posts suggestions via SSE diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-sil", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Voice UX guide for product teams" });
    const ctx = buildToolContext({ interviewId: "int-sil", worker });
    const diffs: { type: string }[] = [];
    worker.on("diff", (d) => diffs.push(d as { type: string }));

    const startedAt = Date.now();
    const result = await suggestInternalLinks.handler({}, ctx);
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(result).toEqual({ ok: true, summary: "queued" });

    // Flush microtasks so the background query resolves.
    await Promise.resolve();
    await Promise.resolve();
    expect(
      diffs.some((d) => d.type === "internal_link_suggestions_updated"),
    ).toBe(true);
    expect(worker.getCanvas().internalLinkSuggestions ?? []).toHaveLength(1);
  });
});
