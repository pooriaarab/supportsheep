import { describe, expect, it } from "vitest";
import embedLoom from "./embed-loom";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-embed-lo", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-embed-lo", worker }) };
}

describe("embed_loom tool", () => {
  it("inserts a Loom embed with a canonical embed URL", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedLoom.handler(
      {
        sectionId: "section-1",
        videoId: "abcdef0123456789abcdef0123456789",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const block = worker.getCanvas().sections[0].blocks?.[0];
    expect(block).toMatchObject({ type: "embed", kind: "loom" });
    expect((block as { src: string }).src).toMatch(
      /^https:\/\/www\.loom\.com\/embed\//,
    );
  });

  it("rejects a non-hex video id", () => {
    const parsed = embedLoom.argsSchema.safeParse({
      sectionId: "section-1",
      videoId: "https://www.loom.com/share/abc",
    });
    expect(parsed.success).toBe(false);
  });
});
