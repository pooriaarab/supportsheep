import { describe, expect, it } from "vitest";
import applySubscript from "./apply-subscript";
import applySuperscript from "./apply-superscript";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_subscript tool", () => {
  it("wraps the requested range in <sub>", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-sub-1", [
      { paragraphs: ["H2O is water"] },
    ]);
    const result = await applySubscript.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 1, to: 2 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "H<sub>2</sub>O is water",
    );
  });

  it("returns not-found when the paragraph id is unknown", async () => {
    const { ctx } = makePhase3Fixture("int-sub-2", [{ paragraphs: ["x"] }]);
    const result = await applySubscript.handler(
      {
        sectionId: "section-1",
        paragraphId: "section-1-p-99",
        range: { from: 0, to: 1 },
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});

describe("apply_superscript tool", () => {
  it("wraps the requested range in <sup>", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-sup-1", [
      { paragraphs: ["E=mc2 always"] },
    ]);
    const result = await applySuperscript.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 4, to: 5 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "E=mc<sup>2</sup> always",
    );
  });
});
