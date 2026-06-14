import { describe, expect, it } from "vitest";
import clearFormatting from "./clear-formatting";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("clear_formatting tool", () => {
  it("strips all Phase-3 mark wrappers from the paragraph when range is omitted", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-clear-1", [
      {
        paragraphs: [
          "**bold** and *italic* and ~~strike~~ and `code` and [link](https://x.example) and <u>under</u> and <mark data-color=\"yellow\">hi</mark>",
        ],
      },
    ]);
    const result = await clearFormatting.handler(
      { sectionId: "section-1", paragraphId: paragraphId(0, 0) },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "bold and italic and strike and code and link and under and hi",
    );
  });

  it("only strips marks inside the requested range", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-clear-2", [
      { paragraphs: ["keep **this** but strip **that**"] },
    ]);
    // Range covers "**that**" at the end.
    const text = ctx.getCurrentCanvas().sections[0].paragraphs[0];
    const start = text.indexOf("**that**");
    const result = await clearFormatting.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: start, to: start + "**that**".length },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "keep **this** but strip that",
    );
  });
});
