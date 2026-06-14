import { describe, expect, it } from "vitest";
import replaceText from "./replace-text";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("replace_text tool", () => {
  it("replaces a substring inside a paragraph", async () => {
    const worker = new WriterWorker({ interviewId: "int-rt-1", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-rt-1", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "The cat sat" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await replaceText.handler(
      {
        sectionId: "section-1",
        paragraphId: id,
        oldText: "cat",
        newText: "dog",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs[0]).toBe("The dog sat");
  });

  it("returns not-found when oldText does not appear", async () => {
    const worker = new WriterWorker({ interviewId: "int-rt-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-rt-2", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "The cat sat" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await replaceText.handler(
      {
        sectionId: "section-1",
        paragraphId: id,
        oldText: "fish",
        newText: "dog",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
