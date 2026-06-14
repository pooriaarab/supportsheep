import { describe, expect, it } from "vitest";
import convertToNumberedList from "./convert-to-numbered-list";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("convert_to_numbered_list tool", () => {
  it("creates a numbered list from the source paragraphs", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-numbered-1", [
      { paragraphs: ["step one", "step two"] },
    ]);
    const result = await convertToNumberedList.handler(
      {
        sectionId: "section-1",
        paragraphIds: [paragraphId(0, 0), paragraphId(0, 1)],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = ctx.getCurrentCanvas().sections[0];
    expect(section.lists?.[0].kind).toBe("numbered");
    expect(section.paragraphs).toEqual([]);
  });
});
