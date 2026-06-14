import { describe, expect, it } from "vitest";
import applyStrike from "./apply-strike";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_strike tool", () => {
  it("wraps the requested range with ~~ markers", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-strike-1", [
      { paragraphs: ["old text"] },
    ]);
    const result = await applyStrike.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 3 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "~~old~~ text",
    );
  });
});
