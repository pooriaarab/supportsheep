import { describe, expect, it } from "vitest";
import insertTable from "./insert-table";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-1", worker }) };
}

describe("insert_table tool", () => {
  it("inserts a table with the given dimensions and headers", async () => {
    const { worker, ctx } = makeCtx();
    const result = await insertTable.handler(
      {
        sectionId: "section-1",
        rows: 3,
        cols: 2,
        headers: ["Name", "Value"],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({
      type: "table",
      rows: 3,
      cols: 2,
      headers: ["Name", "Value"],
    });
  });

  it("rejects headers length mismatch with cols", () => {
    const parsed = insertTable.argsSchema.safeParse({
      sectionId: "section-1",
      rows: 2,
      cols: 3,
      headers: ["A", "B"], // length 2 != cols 3
    });
    expect(parsed.success).toBe(false);
  });
});
