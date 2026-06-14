import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateImage = vi.hoisted(() => vi.fn());
const mockAppendEvents = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockEmitCompletion = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/ai/generate-image", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    generateImage: mockGenerateImage,
  };
});

vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

vi.mock("./_narration-events", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    emitFireAndForgetCompletion: mockEmitCompletion,
  };
});

import requestFeaturedImage from "./request-featured-image";
import { WriterWorker } from "../writer-worker";
import { buildToolContext, clearSessionState, dispatchTool } from "./index";

describe("request_featured_image tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionState("int-featured");
  });

  it("acks immediately even when the upstream call is slow", async () => {
    let resolveImage!: (value: {
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
      interviewId: "int-featured",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-featured", worker });

    const startedAt = Date.now();
    const result = await requestFeaturedImage.handler(
      { prompt: "a cinematic shot of an interview" },
      ctx,
    );
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(result).toEqual({ ok: true, summary: "queued" });
    // Canvas is still empty until the background work resolves.
    expect(worker.getCanvas().featuredImage).toBeUndefined();

    resolveImage({
      url: "https://example.com/hero.png",
      alt: "Hero alt",
      prompt: "p",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(worker.getCanvas().featuredImage?.url).toBe(
      "https://example.com/hero.png",
    );
  });

  it("emits a featured_image_updated diff once background work completes", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "https://example.com/hero.png",
      alt: "Hero alt",
      prompt: "p",
    });

    const worker = new WriterWorker({
      interviewId: "int-featured",
      apiKey: "k",
    });
    const diffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((diff) => {
      diffs.push(diff as { type: string; payload: unknown });
    });
    const ctx = buildToolContext({ interviewId: "int-featured", worker });

    await requestFeaturedImage.handler(
      { prompt: "a cinematic shot of an interview" },
      ctx,
    );
    // Flush microtasks so the detached background work resolves.
    await Promise.resolve();
    await Promise.resolve();

    const featuredDiff = diffs.find((d) => d.type === "featured_image_updated");
    expect(featuredDiff).toBeDefined();
    const payload = featuredDiff?.payload as {
      image: { url: string; alt: string };
    };
    expect(payload.image.url).toBe("https://example.com/hero.png");
    expect(payload.image.alt).toBe("Hero alt");
  });

  it("emits a tool_failed event when the background generateImage call throws", async () => {
    mockGenerateImage.mockRejectedValue(new Error("OPENAI_API_KEY missing"));

    const worker = new WriterWorker({
      interviewId: "int-featured",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-featured", worker });

    await requestFeaturedImage.handler(
      { prompt: "a cinematic shot of an interview" },
      ctx,
    );
    // Flush microtasks so the detached background work runs and the
    // failure-emission promise settles.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    // The canvas never gets a featured image …
    expect(worker.getCanvas().featuredImage).toBeUndefined();
    // … and a tool_failed event was written to D1 (interview_events) so the
    // AI receives a narration on the SSE stream.
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0]?.[2] as Array<{
      kind: string;
      payload: { toolName: string; errorKind: string; message: string };
    }>;
    const payload = events[0];
    expect(payload.kind).toBe("tool_failed");
    expect(payload.payload.toolName).toBe("request_featured_image");
    expect(payload.payload.errorKind).toBe("upstream_error");
    expect(payload.payload.message).toContain("OPENAI_API_KEY");
  });

  it("returns a cached ack on duplicate calls within the dedupe window", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "u",
      alt: "a",
      prompt: "p",
    });

    const worker = new WriterWorker({
      interviewId: "int-featured",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-featured", worker });

    const first = await dispatchTool(
      "request_featured_image",
      { prompt: "same" },
      ctx,
    );
    const second = await dispatchTool(
      "request_featured_image",
      { prompt: "same" },
      ctx,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // generateImage is invoked at most once thanks to dedupe — the
    // second dispatch returns the cached ack without re-queueing.
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("emits a tool_completed narration cue when the background image generation finishes", async () => {
    mockGenerateImage.mockResolvedValue({
      url: "https://example.com/done.png",
      alt: "alt",
      prompt: "p",
    });
    const worker = new WriterWorker({
      interviewId: "int-featured-done",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-featured-done", worker });

    await requestFeaturedImage.handler({ prompt: "finished" }, ctx);
    // Let the detached promise chain settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockEmitCompletion).toHaveBeenCalledWith(
      "int-featured-done",
      "request_featured_image",
      { ok: true, summary: "featured_image_ready" },
    );
  });

  it("emits a tool_completed narration cue with the failure message when the background image generation throws", async () => {
    mockGenerateImage.mockRejectedValueOnce(new Error("upstream 503"));
    const worker = new WriterWorker({
      interviewId: "int-featured-fail",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-featured-fail", worker });

    await requestFeaturedImage.handler({ prompt: "boom" }, ctx);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockEmitCompletion).toHaveBeenCalledWith(
      "int-featured-fail",
      "request_featured_image",
      { ok: false, message: "upstream 503" },
    );
  });
});
