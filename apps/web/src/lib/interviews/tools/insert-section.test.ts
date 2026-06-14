import { describe, expect, it } from "vitest";
import insertSection from "./insert-section";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("insert_section tool", () => {
  it("appends a new section at the end when afterSectionId is omitted", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    const result = await insertSection.handler(
      { heading: "Background", level: 2 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("section_inserted");
      expect((result.data as { sectionId: string }).sectionId).toBe("section-1");
    }
    expect(worker.getCanvas().sections).toHaveLength(1);
    expect(worker.getCanvas().sections[0].level).toBe(2);
  });

  it("inserts immediately after a target section id", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    await addHeading.handler({ text: "A" }, ctx);
    await addHeading.handler({ text: "B" }, ctx);
    const result = await insertSection.handler(
      { heading: "AB", afterSectionId: "section-1" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const ids = worker.getCanvas().sections.map((s) => s.id);
    // section-1 (A), section-3 (newly inserted AB), section-2 (B)
    expect(ids).toEqual(["section-1", "section-3", "section-2"]);
  });

  it("returns not-found when afterSectionId references an unknown section", async () => {
    const worker = new WriterWorker({ interviewId: "int-3", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-3", worker });

    const result = await insertSection.handler(
      { heading: "Orphan", afterSectionId: "section-99" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
