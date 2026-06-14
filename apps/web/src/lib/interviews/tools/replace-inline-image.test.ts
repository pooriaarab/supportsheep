import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateImage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/generate-image", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    generateImage: mockGenerateImage,
  };
});

import replaceInlineImage from "./replace-inline-image";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("replace_inline_image tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("swaps a known URL synchronously", async () => {
    const worker = new WriterWorker({
      interviewId: "int-replace",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const placed = worker.insertInlineImage({
      sectionId: "section-1",
      url: "https://example.com/v1.png",
      alt: "v1",
    });
    expect(placed).not.toBeNull();
    const ctx = buildToolContext({ interviewId: "int-replace", worker });

    const result = await replaceInlineImage.handler(
      { imageId: placed!.id, url: "https://example.com/v2.png" },
      ctx,
    );
    expect(result).toEqual({ ok: true, summary: "queued" });
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(
      worker.getCanvas().sections[0].inlineImages?.[0].url,
    ).toBe("https://example.com/v2.png");
  });

  it("returns not-found when the image id is unknown", async () => {
    const worker = new WriterWorker({
      interviewId: "int-replace",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-replace", worker });
    const result = await replaceInlineImage.handler(
      { imageId: "image-nope", url: "https://example.com/v2.png" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
