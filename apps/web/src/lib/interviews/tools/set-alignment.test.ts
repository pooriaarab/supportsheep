import { describe, expect, it } from "vitest";
import setAlignment from "./set-alignment";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_alignment tool", () => {
  it("sets the alignment on a paragraph and surfaces it on the canvas", async () => {
    const worker = new WriterWorker({ interviewId: "int-al-1", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-al-1", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "Centered" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await setAlignment.handler(
      { paragraphId: id, alignment: "center" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphAlignments).toEqual(["center"]);
  });

  it("rejects an unknown paragraph id with a not-found error", async () => {
    const worker = new WriterWorker({ interviewId: "int-al-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-al-2", worker });

    const result = await setAlignment.handler(
      { paragraphId: "section-1-p99", alignment: "right" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("rejects an invalid alignment value at the schema level", () => {
    const parsed = setAlignment.argsSchema.safeParse({
      paragraphId: "section-1-p0",
      alignment: "diagonal",
    });
    expect(parsed.success).toBe(false);
  });
});
