import { describe, expect, it, beforeEach } from "vitest";
import embedYoutube from "./embed-youtube";
import { WriterWorker } from "../writer-worker";
import { buildToolContext, clearSessionState, dispatchTool } from "./index";

function makeCtx(interviewId = "int-embed-yt") {
  const worker = new WriterWorker({ interviewId, apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId, worker }) };
}

describe("embed_youtube tool", () => {
  beforeEach(() => {
    clearSessionState("int-embed-yt");
    clearSessionState("int-embed-yt-dedupe");
  });

  it("inserts a YouTube embed with a sanitized iframe src", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedYoutube.handler(
      { sectionId: "section-1", videoId: "dQw4w9WgXcQ" },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { src: string };
      expect(data.src).toMatch(
        /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
      );
    }
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({
      type: "embed",
      kind: "youtube",
    });
  });

  it("includes the start parameter when startSeconds is provided", async () => {
    const { ctx } = makeCtx();
    const result = await embedYoutube.handler(
      { sectionId: "section-1", videoId: "dQw4w9WgXcQ", startSeconds: 42 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { src: string };
      expect(data.src).toContain("start=42");
    }
  });

  it("rejects a videoId that does not match the 11-char base64url pattern", () => {
    const cases = [
      "shortid",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "way-too-long-videoid",
      "with spaces",
    ];
    for (const videoId of cases) {
      const parsed = embedYoutube.argsSchema.safeParse({
        sectionId: "section-1",
        videoId,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("dedupes a second identical call within the window via the registry", async () => {
    // Build a worker the registry can drive end-to-end so we exercise
    // the dispatcher's dedupe path, not just the handler.
    const worker = new WriterWorker({
      interviewId: "int-embed-yt-dedupe",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({
      interviewId: "int-embed-yt-dedupe",
      worker,
    });

    const first = await dispatchTool(
      "embed_youtube",
      { sectionId: "section-1", videoId: "dQw4w9WgXcQ" },
      ctx,
    );
    const second = await dispatchTool(
      "embed_youtube",
      { sectionId: "section-1", videoId: "dQw4w9WgXcQ" },
      ctx,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // Only one block should have been inserted — the second call hit
    // the dedupe cache and returned the prior result without
    // re-invoking the handler.
    const section = worker.getCanvas().sections[0];
    expect(section.blocks).toHaveLength(1);
  });
});
