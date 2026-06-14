import { describe, expect, it } from "vitest";
import applyBold from "./apply-bold";
import applyItalic from "./apply-italic";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_bold tool", () => {
  it("wraps the requested range with ** markers", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-bold-1", [
      { paragraphs: ["Hello world"] },
    ]);
    const result = await applyBold.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 6, to: 11 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "Hello **world**",
    );
  });

  it("returns not-found when the paragraph id is unknown", async () => {
    const { ctx } = makePhase3Fixture("int-bold-2", [
      { paragraphs: ["Hello"] },
    ]);
    const result = await applyBold.handler(
      {
        sectionId: "section-1",
        paragraphId: "section-1-p-99",
        range: { from: 0, to: 3 },
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("composes with apply_italic on overlapping ranges (integration)", async () => {
    // Bold first ("Hello"), then italic on the inner range — the
    // resulting markdown should layer the marks without losing text.
    const { ctx, paragraphId } = makePhase3Fixture("int-bold-3", [
      { paragraphs: ["Hello world"] },
    ]);
    const boldResult = await applyBold.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 5 },
      },
      ctx,
    );
    expect(boldResult.ok).toBe(true);
    const afterBold = ctx.getCurrentCanvas().sections[0].paragraphs[0];
    expect(afterBold).toBe("**Hello** world");
    // Now italicise "Hello" — including the surrounding ** so the
    // resulting markdown layers correctly (`***Hello***` is valid).
    const italicResult = await applyItalic.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 9 }, // covers "**Hello**"
      },
      ctx,
    );
    expect(italicResult.ok).toBe(true);
    const finalText = ctx.getCurrentCanvas().sections[0].paragraphs[0];
    expect(finalText).toContain("Hello");
    expect(finalText).toContain("**");
    expect(finalText).toContain("*");
  });
});
