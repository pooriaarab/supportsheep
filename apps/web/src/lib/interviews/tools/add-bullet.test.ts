import { describe, expect, it } from "vitest";
import addBullet from "./add-bullet";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("add_bullet tool", () => {
  it("appends a bullet to the most recently added section", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Intro" }, ctx);

    const result = await addBullet.handler({ text: "first point" }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections[0].bullets).toEqual(["first point"]);
  });

  it("is a no-op when no section exists yet (preserves pre-registry behaviour)", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });
    const result = await addBullet.handler({ text: "orphan" }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().sections).toHaveLength(0);
  });
});
