import { describe, expect, it } from "vitest";
import insertDivider from "./insert-divider";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-1", worker }) };
}

describe("insert_divider tool", () => {
  it("inserts a divider block", async () => {
    const { worker, ctx } = makeCtx();
    const result = await insertDivider.handler({ sectionId: "section-1" }, ctx);
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({ type: "divider" });
  });
});
