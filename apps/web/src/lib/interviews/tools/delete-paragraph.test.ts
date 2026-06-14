import { describe, expect, it } from "vitest";
import deleteParagraph from "./delete-paragraph";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("delete_paragraph tool", () => {
  it("removes a paragraph by id", async () => {
    const worker = new WriterWorker({ interviewId: "int-del", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-del", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "Goodbye" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const paragraphId = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await deleteParagraph.handler(
      { sectionId: "section-1", paragraphId },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual([]);
    expect(worker.getCanvas().sections[0].paragraphIds).toEqual([]);
  });

  it("returns not-found for an unknown paragraph id", async () => {
    const worker = new WriterWorker({ interviewId: "int-del-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-del-2", worker });

    const result = await deleteParagraph.handler(
      { sectionId: "section-1", paragraphId: "section-1-p99" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
