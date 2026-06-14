import { describe, expect, it } from "vitest";
import nestListItem from "./nest-list-item";
import convertToBulletList from "./convert-to-bullet-list";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("nest_list_item tool", () => {
  it("increments the item's level when direction is 'in'", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-nest-1", [
      { paragraphs: ["a", "b"] },
    ]);
    const convert = await convertToBulletList.handler(
      {
        sectionId: "section-1",
        paragraphIds: [paragraphId(0, 0), paragraphId(0, 1)],
      },
      ctx,
    );
    const listId = (convert as { ok: true; data: { listId: string } }).data
      .listId;
    const list = ctx.getCurrentCanvas().sections[0].lists?.[0];
    const itemId = list!.items[1].id;

    const result = await nestListItem.handler(
      { listId, itemId, direction: "in" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const after = ctx.getCurrentCanvas().sections[0].lists?.[0].items[1];
    expect(after?.level).toBe(1);
  });

  it("returns not-found when the item id is unknown", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-nest-2", [
      { paragraphs: ["only"] },
    ]);
    const convert = await convertToBulletList.handler(
      { sectionId: "section-1", paragraphIds: [paragraphId(0, 0)] },
      ctx,
    );
    const listId = (convert as { ok: true; data: { listId: string } }).data
      .listId;
    const result = await nestListItem.handler(
      { listId, itemId: "missing", direction: "in" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
