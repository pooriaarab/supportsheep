import { describe, expect, it } from "vitest";
import applyHighlight from "./apply-highlight";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_highlight tool", () => {
  it("wraps the requested range with a colour-tagged mark element", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-highlight-1", [
      { paragraphs: ["key insight here"] },
    ]);
    const result = await applyHighlight.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 11 },
        color: "yellow",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      '<mark data-color="yellow">key insight</mark> here',
    );
  });
});
