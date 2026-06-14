import { describe, expect, it } from "vitest";
import applyUnderline from "./apply-underline";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_underline tool", () => {
  it("wraps the requested range with <u> tags", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-underline-1", [
      { paragraphs: ["A bit of text"] },
    ]);
    const result = await applyUnderline.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 2, to: 5 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "A <u>bit</u> of text",
    );
  });
});
