import { describe, expect, it } from "vitest";
import applyLink from "./apply-link";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("apply_link tool", () => {
  it("wraps the requested range as a markdown link", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-link-1", [
      { paragraphs: ["See the docs"] },
    ]);
    const result = await applyLink.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 4, to: 12 },
        url: "https://example.com",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "See [the docs](https://example.com)",
    );
  });
});
