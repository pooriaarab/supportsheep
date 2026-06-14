import { describe, expect, it } from "vitest";
import deleteSection from "./delete-section";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("delete_section tool", () => {
  it("removes the section and emits section_removed diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Doomed" }, ctx);
    await addBullet.handler({ text: "Bullet" }, ctx);

    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await deleteSection.handler(
      { sectionId: "section-1" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections).toHaveLength(0);
    expect(diffs).toEqual([
      { type: "section_removed", payload: { sectionId: "section-1" } },
    ]);
  });

  it("returns not-found for unknown section ids", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    const result = await deleteSection.handler(
      { sectionId: "section-99" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
