import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateImage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/generate-image", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    generateImage: mockGenerateImage,
  };
});

import regenerateFeaturedImage from "./regenerate-featured-image";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("regenerate_featured_image tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acks immediately and replaces the existing featured image", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "https://example.com/hero-v2.png",
      alt: "v2 alt",
      prompt: "p2",
    });
    const worker = new WriterWorker({
      interviewId: "int-regen",
      apiKey: "k",
    });
    worker.setFeaturedImage({
      url: "https://example.com/hero-v1.png",
      alt: "v1 alt",
      prompt: "p1",
    });
    const originalId = worker.getCanvas().featuredImage?.id;
    const ctx = buildToolContext({ interviewId: "int-regen", worker });

    const startedAt = Date.now();
    const result = await regenerateFeaturedImage.handler(
      { reason: "too dark" },
      ctx,
    );
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(result).toEqual({ ok: true, summary: "queued" });

    await Promise.resolve();
    await Promise.resolve();
    // Same image id, new url — `replaceImage` preserves identity.
    expect(worker.getCanvas().featuredImage?.id).toBe(originalId);
    expect(worker.getCanvas().featuredImage?.url).toBe(
      "https://example.com/hero-v2.png",
    );
  });
});
