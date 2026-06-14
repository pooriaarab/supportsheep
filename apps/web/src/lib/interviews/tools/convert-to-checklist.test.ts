import { describe, expect, it } from "vitest";
import convertToChecklist from "./convert-to-checklist";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("convert_to_checklist tool", () => {
  it("creates a checklist with unchecked items", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-checklist-1", [
      { paragraphs: ["todo a", "todo b"] },
    ]);
    const result = await convertToChecklist.handler(
      {
        sectionId: "section-1",
        paragraphIds: [paragraphId(0, 0), paragraphId(0, 1)],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = ctx.getCurrentCanvas().sections[0];
    expect(section.lists?.[0].kind).toBe("checklist");
    expect(section.lists?.[0].items.every((i) => i.checked === false)).toBe(
      true,
    );
  });
});
