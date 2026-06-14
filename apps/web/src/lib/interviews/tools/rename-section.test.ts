import { describe, expect, it } from "vitest";
import renameSection from "./rename-section";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("rename_section tool", () => {
  it("renames the heading and preserves content", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });

    await addHeading.handler({ text: "Old Heading" }, ctx);
    await addBullet.handler({ text: "Keep me" }, ctx);

    const result = await renameSection.handler(
      { sectionId: "section-1", heading: "New Heading" },
      ctx,
    );
    expect(result.ok).toBe(true);

    const canvas = worker.getCanvas();
    expect(canvas.sections[0].heading).toBe("New Heading");
    expect(canvas.sections[0].bullets).toEqual(["Keep me"]);
  });

  it("returns not-found for unknown section ids", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    const result = await renameSection.handler(
      { sectionId: "section-99", heading: "New" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
