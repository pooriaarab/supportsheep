import { describe, expect, it } from "vitest";
import addListItem from "./add-list-item";
import convertToBulletList from "./convert-to-bullet-list";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("add_list_item tool", () => {
  it("appends a new item to an existing list when position is omitted", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-add-item-1", [
      { paragraphs: ["first"] },
    ]);
    const convert = await convertToBulletList.handler(
      { sectionId: "section-1", paragraphIds: [paragraphId(0, 0)] },
      ctx,
    );
    expect(convert.ok).toBe(true);
    const listId = (convert as { ok: true; data: { listId: string } }).data
      .listId;

    const result = await addListItem.handler(
      { listId, text: "second" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const list = ctx.getCurrentCanvas().sections[0].lists?.[0];
    expect(list?.items.map((i) => i.text)).toEqual(["first", "second"]);
  });

  it("returns not-found when the list id is unknown", async () => {
    const { ctx } = makePhase3Fixture("int-add-item-2", [
      { paragraphs: ["x"] },
    ]);
    const result = await addListItem.handler(
      { listId: "missing", text: "x" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
