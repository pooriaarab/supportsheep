import { describe, expect, it } from "vitest";
import setHeadingLevel from "./set-heading-level";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_heading_level tool", () => {
  it("changes the section level and emits section_updated diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    await addHeading.handler({ text: "A" }, ctx);
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await setHeadingLevel.handler(
      { sectionId: "section-1", level: 3 },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].level).toBe(3);
    expect(diffs).toEqual([
      {
        type: "section_updated",
        payload: { id: "section-1", level: 3 },
      },
    ]);
  });

  it("rejects levels outside 2/3/4", () => {
    expect(
      setHeadingLevel.argsSchema.safeParse({
        sectionId: "section-1",
        level: 1,
      }).success,
    ).toBe(false);
    expect(
      setHeadingLevel.argsSchema.safeParse({
        sectionId: "section-1",
        level: 5,
      }).success,
    ).toBe(false);
  });

  it("returns not-found for unknown section ids", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    const result = await setHeadingLevel.handler(
      { sectionId: "section-99", level: 3 },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
