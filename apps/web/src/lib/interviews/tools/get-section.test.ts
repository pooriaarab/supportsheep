import { describe, expect, it } from "vitest";
import getSection from "./get-section";
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("get_section tool", () => {
  it("returns the section's current heading, bullets, paragraphs, quotes", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    await addHeading.handler({ text: "Heading" }, ctx);
    await addBullet.handler({ text: "Bullet 1" }, ctx);
    await addBullet.handler({ text: "Bullet 2" }, ctx);

    const result = await getSection.handler({ section_id: "section-1" }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        id: string;
        heading: string;
        bullets: string[];
      };
      expect(data.id).toBe("section-1");
      expect(data.heading).toBe("Heading");
      expect(data.bullets).toEqual(["Bullet 1", "Bullet 2"]);
    }
  });

  it("returns not-found for unknown section ids", async () => {
    const worker = new WriterWorker({ interviewId: "int-2", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-2", worker });

    const result = await getSection.handler({ section_id: "section-99" }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("not-found");
      expect(result.message).toContain("section-99");
    }
  });
});
