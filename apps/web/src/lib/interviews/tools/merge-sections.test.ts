import { describe, expect, it } from "vitest";
import mergeSections from "./merge-sections";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import addQuote from "./add-quote";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("merge_sections tool", () => {
  it("appends source bullets/quotes into target and deletes source", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    await addHeading.handler({ text: "Into" }, ctx);
    await addBullet.handler({ text: "Into-bullet" }, ctx);
    await addHeading.handler({ text: "From" }, ctx);
    await addBullet.handler({ text: "From-bullet" }, ctx);
    await addQuote.handler({ text: "qq", attributedTo: "P" }, ctx);

    const result = await mergeSections.handler(
      { fromSectionId: "section-2", intoSectionId: "section-1" },
      ctx,
    );
    expect(result.ok).toBe(true);

    const canvas = worker.getCanvas();
    expect(canvas.sections).toHaveLength(1);
    const survivor = canvas.sections[0];
    expect(survivor.id).toBe("section-1");
    expect(survivor.heading).toBe("Into");
    expect(survivor.bullets).toEqual(["Into-bullet", "From-bullet"]);
    expect(survivor.quotes).toEqual([{ text: "qq", attributedTo: "P" }]);
  });

  it("returns not-found when either side does not exist", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    await addHeading.handler({ text: "Only" }, ctx);

    const result = await mergeSections.handler(
      { fromSectionId: "section-99", intoSectionId: "section-1" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("rejects merging a section into itself at the schema layer", () => {
    expect(
      mergeSections.argsSchema.safeParse({
        fromSectionId: "section-1",
        intoSectionId: "section-1",
      }).success,
    ).toBe(false);
  });
});
