import { describe, expect, it } from "vitest";
import convertToBulletList from "./convert-to-bullet-list";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("convert_to_bullet_list tool", () => {
  it("removes the source paragraphs and creates a bullet list (integration)", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-bullet-1", [
      { paragraphs: ["first item", "second item", "keep me"] },
    ]);
    const result = await convertToBulletList.handler(
      {
        sectionId: "section-1",
        paragraphIds: [paragraphId(0, 0), paragraphId(0, 1)],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = ctx.getCurrentCanvas().sections[0];
    expect(section.paragraphs).toEqual(["keep me"]);
    expect(section.lists?.length).toBe(1);
    expect(section.lists?.[0].kind).toBe("bullet");
    expect(section.lists?.[0].items.map((i) => i.text)).toEqual([
      "first item",
      "second item",
    ]);
  });

  it("returns not-found when the section is unknown", async () => {
    const { ctx } = makePhase3Fixture("int-bullet-2", [
      { paragraphs: ["one"] },
    ]);
    const result = await convertToBulletList.handler(
      { sectionId: "nope", paragraphIds: ["section-1-p-0"] },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
