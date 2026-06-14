import { describe, expect, it } from "vitest";
import applyCode from "./apply-code";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_code tool", () => {
  it("wraps the requested range with backticks for inline code", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-code-1", [
      { paragraphs: ["Run npm install"] },
    ]);
    const result = await applyCode.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 4, to: 15 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "Run `npm install`",
    );
  });
});
