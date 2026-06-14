import { describe, expect, it } from "vitest";
import insertVideo from "./insert-video";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("insert_video tool", () => {
  it("routes YouTube URLs to the youtube embed kind", async () => {
    const worker = new WriterWorker({
      interviewId: "int-video-1",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const ctx = buildToolContext({ interviewId: "int-video-1", worker });
    const result = await insertVideo.handler(
      {
        sectionId: "section-1",
        url: "https://www.youtube.com/watch?v=abc123",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { kind: string }).kind).toBe("youtube");
    }
  });

  it("routes Vimeo URLs to the iframe embed kind", async () => {
    const worker = new WriterWorker({
      interviewId: "int-video-2",
      apiKey: "k",
    });
    worker.applyToolCall("add_heading", { text: "Body" });
    const ctx = buildToolContext({ interviewId: "int-video-2", worker });
    const result = await insertVideo.handler(
      {
        sectionId: "section-1",
        url: "https://vimeo.com/123456789",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { kind: string }).kind).toBe("iframe");
    }
  });

  it("returns not-found for an unknown section", async () => {
    const worker = new WriterWorker({
      interviewId: "int-video-3",
      apiKey: "k",
    });
    const ctx = buildToolContext({ interviewId: "int-video-3", worker });
    const result = await insertVideo.handler(
      {
        sectionId: "section-nope",
        url: "https://www.youtube.com/watch?v=abc",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("rejects unsafe URLs (http, loopback, etc.)", () => {
    const parsed = insertVideo.argsSchema.safeParse({
      sectionId: "section-1",
      url: "http://localhost:8080/video.mp4",
    });
    expect(parsed.success).toBe(false);
  });
});
