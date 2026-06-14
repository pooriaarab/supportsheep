import { describe, expect, it } from "vitest";
import insertBlockquote from "./insert-blockquote";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx(interviewId = "int-1") {
  const worker = new WriterWorker({ interviewId, apiKey: "k" });
  // Seed one section so we have a valid sectionId target.
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId, worker }) };
}

describe("insert_blockquote tool", () => {
  it("appends a blockquote to the target section and emits a diff", async () => {
    const { worker, ctx } = makeCtx();
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await insertBlockquote.handler(
      {
        sectionId: "section-1",
        text: "We will not back down.",
        attribution: "Jane Doe",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks).toBeDefined();
    expect(section.blocks?.[0]).toMatchObject({
      type: "blockquote",
      text: "We will not back down.",
      attribution: "Jane Doe",
    });
    expect(diffs.some((d) => (d as { type: string }).type === "section_block_added")).toBe(true);
  });

  it("returns not-found for an unknown section id", async () => {
    const { ctx } = makeCtx();
    const result = await insertBlockquote.handler(
      { sectionId: "section-999", text: "Lost quote" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("not-found");
    }
  });
});
