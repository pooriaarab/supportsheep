import { describe, expect, it } from "vitest";
import insertCallout from "./insert-callout";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-1", worker }) };
}

describe("insert_callout tool", () => {
  it("inserts an info callout with a title and body", async () => {
    const { worker, ctx } = makeCtx();
    const result = await insertCallout.handler(
      {
        sectionId: "section-1",
        kind: "info",
        title: "Heads up",
        body: "This is important.",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({
      type: "callout",
      kind: "info",
      title: "Heads up",
      body: "This is important.",
    });
  });

  it("rejects an unknown callout kind", () => {
    const parsed = insertCallout.argsSchema.safeParse({
      sectionId: "section-1",
      kind: "tip", // not in the {info, warning, success, danger} enum
      body: "x",
    });
    expect(parsed.success).toBe(false);
  });
});
