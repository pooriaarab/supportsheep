import { describe, expect, it } from "vitest";
import joinParagraphs from "./join-paragraphs";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("join_paragraphs tool", () => {
  it("concatenates two adjacent paragraphs with a single-space separator", async () => {
    const worker = new WriterWorker({ interviewId: "int-jp-1", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-jp-1", worker });

    const a = await insertParagraph.handler({ sectionId: "section-1", text: "Hello" }, ctx);
    const b = await insertParagraph.handler({ sectionId: "section-1", text: "world." }, ctx);
    if (!a.ok || !b.ok) throw new Error("insert failed");
    const aId = (a.data as { paragraphId: string }).paragraphId;
    const bId = (b.data as { paragraphId: string }).paragraphId;

    const result = await joinParagraphs.handler({ firstId: aId, secondId: bId }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["Hello world."]);
    expect(worker.getCanvas().sections[0].paragraphIds).toEqual([aId]);
  });

  it("rejects non-adjacent paragraphs with a validation error", async () => {
    const worker = new WriterWorker({ interviewId: "int-jp-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-jp-2", worker });

    const a = await insertParagraph.handler({ sectionId: "section-1", text: "A" }, ctx);
    await insertParagraph.handler({ sectionId: "section-1", text: "B" }, ctx);
    const c = await insertParagraph.handler({ sectionId: "section-1", text: "C" }, ctx);
    if (!a.ok || !c.ok) throw new Error("insert failed");
    const aId = (a.data as { paragraphId: string }).paragraphId;
    const cId = (c.data as { paragraphId: string }).paragraphId;

    const result = await joinParagraphs.handler({ firstId: aId, secondId: cId }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("validation");
  });
});
