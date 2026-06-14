import { describe, expect, it } from "vitest";
import finalizeSection from "./finalize-section";
import addHeading from "./add-heading";
import { WriterWorker, type WriterDiff } from "../writer-worker";
import { buildToolContext } from "./index";

describe("finalize_section tool", () => {
  it("marks a section finalized and emits section_finalized diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Intro" }, ctx);

    const diffs: WriterDiff[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await finalizeSection.handler({ sectionId: "section-1" }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].finalized).toBe(true);
    expect(diffs.find((d) => d.type === "section_finalized")).toBeTruthy();
  });

  it("silently absorbs unknown sectionId (preserves pre-registry behaviour)", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });
    const result = await finalizeSection.handler({ sectionId: "nope" }, ctx);
    expect(result.ok).toBe(true);
  });
});
