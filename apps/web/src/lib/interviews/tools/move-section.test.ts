import { describe, expect, it } from "vitest";
import moveSection from "./move-section";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("move_section tool", () => {
  it("reorders sections by id to the given index", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    await addHeading.handler({ text: "A" }, ctx);
    await addHeading.handler({ text: "B" }, ctx);
    await addHeading.handler({ text: "C" }, ctx);

    // Move section-3 to the top
    const result = await moveSection.handler(
      { sectionId: "section-3", toIndex: 0 },
      ctx,
    );
    expect(result.ok).toBe(true);
    const ids = worker.getCanvas().sections.map((s) => s.id);
    expect(ids).toEqual(["section-3", "section-1", "section-2"]);
  });

  it("clamps toIndex larger than the list to the end", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    await addHeading.handler({ text: "A" }, ctx);
    await addHeading.handler({ text: "B" }, ctx);

    await moveSection.handler({ sectionId: "section-1", toIndex: 99 }, ctx);
    const ids = worker.getCanvas().sections.map((s) => s.id);
    expect(ids).toEqual(["section-2", "section-1"]);
  });

  it("returns not-found for unknown section ids", async () => {
    const worker = new WriterWorker({ interviewId: "int-3", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-3", worker });

    const result = await moveSection.handler(
      { sectionId: "section-99", toIndex: 0 },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
