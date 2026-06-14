import { describe, expect, it } from "vitest";
import moveParagraph from "./move-paragraph";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("move_paragraph tool", () => {
  it("moves a paragraph within the same section", async () => {
    const worker = new WriterWorker({ interviewId: "int-mv-1", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-mv-1", worker });

    const a = await insertParagraph.handler({ sectionId: "section-1", text: "A" }, ctx);
    await insertParagraph.handler({ sectionId: "section-1", text: "B" }, ctx);
    await insertParagraph.handler({ sectionId: "section-1", text: "C" }, ctx);
    if (!a.ok) throw new Error("a failed");
    const aId = (a.data as { paragraphId: string }).paragraphId;

    const result = await moveParagraph.handler(
      {
        paragraphId: aId,
        fromSectionId: "section-1",
        toSectionId: "section-1",
        toIndex: 2,
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["B", "C", "A"]);
  });

  it("moves a paragraph across sections", async () => {
    const worker = new WriterWorker({ interviewId: "int-mv-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "S1" });
    worker.applyToolCall("add_heading", { text: "S2" });
    const ctx = buildToolContext({ interviewId: "int-mv-2", worker });

    const a = await insertParagraph.handler({ sectionId: "section-1", text: "moving" }, ctx);
    await insertParagraph.handler({ sectionId: "section-2", text: "existing" }, ctx);
    if (!a.ok) throw new Error("a failed");
    const aId = (a.data as { paragraphId: string }).paragraphId;

    const result = await moveParagraph.handler(
      {
        paragraphId: aId,
        fromSectionId: "section-1",
        toSectionId: "section-2",
        toIndex: 0,
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const canvas = worker.getCanvas();
    expect(canvas.sections[0].paragraphs).toEqual([]);
    expect(canvas.sections[1].paragraphs).toEqual(["moving", "existing"]);
  });

  it("returns not-found for an unknown source section", async () => {
    const worker = new WriterWorker({ interviewId: "int-mv-3", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-mv-3", worker });

    const result = await moveParagraph.handler(
      {
        paragraphId: "section-1-p0",
        fromSectionId: "no-such",
        toSectionId: "section-1",
        toIndex: 0,
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
