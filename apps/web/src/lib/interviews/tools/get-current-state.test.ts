import { describe, expect, it } from "vitest";
import getCurrentState from "./get-current-state";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("get_current_state tool", () => {
  it("returns a compact snapshot of title, sections, and meta", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Intro" }, ctx);
    await addBullet.handler({ text: "B1" }, ctx);
    await addHeading.handler({ text: "Body" }, ctx);

    const result = await getCurrentState.handler({}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        title: string | null;
        sections: Array<{ id: string; heading: string; bulletCount: number; finalized: boolean }>;
      };
      expect(data.title).toBeNull();
      expect(data.sections.map((s) => s.id)).toEqual(["section-1", "section-2"]);
      expect(data.sections[0].bulletCount).toBe(1);
      expect(data.sections[0].finalized).toBe(false);
    }
  });

  it("returns empty section list when canvas is empty", async () => {
    const worker = new WriterWorker({ interviewId: "int-empty", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-empty", worker });
    const result = await getCurrentState.handler({}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { sections: unknown[] };
      expect(data.sections).toEqual([]);
    }
  });
});
