import { describe, expect, it } from "vitest";
import embedGist from "./embed-gist";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-embed-gs", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-embed-gs", worker }) };
}

describe("embed_gist tool", () => {
  it("inserts a gist embed scoped to a single file", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedGist.handler(
      {
        sectionId: "section-1",
        gistId: "abcdef0123456789abcdef0123456789",
        file: "example.ts",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const block = worker.getCanvas().sections[0].blocks?.[0];
    expect(block).toMatchObject({ type: "embed", kind: "gist" });
    expect((block as { src: string }).src).toContain("file=example.ts");
  });

  it("rejects a non-hex gist id", () => {
    const parsed = embedGist.argsSchema.safeParse({
      sectionId: "section-1",
      gistId: "not-hex-id-zzzz",
    });
    expect(parsed.success).toBe(false);
  });
});
