import { describe, expect, it } from "vitest";
import applyItalic from "./apply-italic";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_italic tool", () => {
  it("wraps the requested range with * markers", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-italic-1", [
      { paragraphs: ["I love coding"] },
    ]);
    const result = await applyItalic.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 2, to: 6 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "I *love* coding",
    );
  });
});
