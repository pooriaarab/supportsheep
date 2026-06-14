import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateImage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/generate-image", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    generateImage: mockGenerateImage,
  };
});

import insertInlineImage from "./insert-inline-image";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("insert_inline_image tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a known URL synchronously without invoking the generator", async () => {
    const worker = new WriterWorker({
      interviewId: "int-inline",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const ctx = buildToolContext({ interviewId: "int-inline", worker });

    const result = await insertInlineImage.handler(
      {
        sectionId: "section-1",
        urlIfKnown: "https://example.com/inline.png",
      },
      ctx,
    );
    expect(result).toEqual({ ok: true, summary: "queued" });
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(
      worker.getCanvas().sections[0].inlineImages,
    ).toHaveLength(1);
  });

  it("returns not-found when the section id is unknown (url path)", async () => {
    const worker = new WriterWorker({
      interviewId: "int-inline",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-inline", worker });
    const result = await insertInlineImage.handler(
      {
        sectionId: "section-nope",
        urlIfKnown: "https://example.com/inline.png",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("acks immediately when a prompt is supplied and runs generation in the background", async () => {
    let resolveImage!: (v: {
      url: string;
      alt: string;
      prompt: string;
    }) => void;
    mockGenerateImage.mockReturnValue(
      new Promise((resolve) => {
        resolveImage = resolve;
      }),
    );
    const worker = new WriterWorker({
      interviewId: "int-inline",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const ctx = buildToolContext({ interviewId: "int-inline", worker });

    const startedAt = Date.now();
    const result = await insertInlineImage.handler(
      { sectionId: "section-1", prompt: "a diagram" },
      ctx,
    );
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(result).toEqual({ ok: true, summary: "queued" });
    expect(worker.getCanvas().sections[0].inlineImages ?? []).toHaveLength(0);

    resolveImage({
      url: "https://example.com/gen.png",
      alt: "a diagram",
      prompt: "p",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(worker.getCanvas().sections[0].inlineImages).toHaveLength(1);
  });

  it("AI-driven inline generation routes prompt to the provider and the URL lands in the section (W24.K regression)", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "https://example.com/monk.png",
      alt: "monk meditating",
      prompt: "monk meditating",
      source: "ai",
    });
    const worker = new WriterWorker({
      interviewId: "int-inline-ai",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const ctx = buildToolContext({ interviewId: "int-inline-ai", worker });

    const result = await insertInlineImage.handler(
      { sectionId: "section-1", prompt: "monk meditating" },
      ctx,
    );
    expect(result).toEqual({ ok: true, summary: "queued" });
    // Drain the fire-and-forget promise queue.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The provider was actually invoked with the AI source — proving
    // the tool is NOT a stub that just inserts a placeholder.
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.purpose).toBe("inline");
    expect(callArgs.source).toBe("ai");
    expect(callArgs.customPrompt).toBe("monk meditating");

    // The resolved URL must land in the canvas section as a real
    // inline image entry (URL populated, not a stub).
    const inline = worker.getCanvas().sections[0].inlineImages;
    expect(inline).toHaveLength(1);
    expect(inline?.[0].url).toBe("https://example.com/monk.png");
  });
});
