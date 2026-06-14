import { describe, expect, it } from "vitest";
import splitParagraph from "./split-paragraph";
import insertParagraph from "./insert-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("split_paragraph tool", () => {
  it("splits a paragraph at the given offset into two", async () => {
    const worker = new WriterWorker({ interviewId: "int-sp-1", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-sp-1", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "Hello world" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    // Split at offset 5 — "Hello" | " world"
    const result = await splitParagraph.handler({ paragraphId: id, atOffset: 5 }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["Hello", " world"]);
  });

  it("splits at a mid-word offset without coercing the boundary", async () => {
    // The catalog contract says offsets are character offsets, not
    // word offsets — an offset inside a word produces two paragraphs
    // each containing a half-word. We assert that behaviour explicitly
    // so a future "snap to word boundary" change is a deliberate spec
    // update, not a silent regression.
    const worker = new WriterWorker({ interviewId: "int-sp-2", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-sp-2", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "Helloworld" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await splitParagraph.handler({ paragraphId: id, atOffset: 5 }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].paragraphs).toEqual(["Hello", "world"]);
  });

  it("returns validation when offset is out of bounds", async () => {
    const worker = new WriterWorker({ interviewId: "int-sp-3", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-sp-3", worker });

    const inserted = await insertParagraph.handler(
      { sectionId: "section-1", text: "Hi" },
      ctx,
    );
    if (!inserted.ok) throw new Error("insert failed");
    const id = (inserted.data as { paragraphId: string }).paragraphId;

    const result = await splitParagraph.handler({ paragraphId: id, atOffset: 99 }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("validation");
  });
});
