import { describe, expect, it } from "vitest";
import completeListItem from "./complete-list-item";
import convertToBulletList from "./convert-to-bullet-list";
import convertToChecklist from "./convert-to-checklist";
import { makePhase3Fixture } from "./_phase3-fixture";

describe("complete_list_item tool", () => {
  it("toggles a checklist item's checked state", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-complete-1", [
      { paragraphs: ["task one"] },
    ]);
    const convert = await convertToChecklist.handler(
      { sectionId: "section-1", paragraphIds: [paragraphId(0, 0)] },
      ctx,
    );
    const listId = (convert as { ok: true; data: { listId: string } }).data
      .listId;
    const list = ctx.getCurrentCanvas().sections[0].lists?.[0];
    const itemId = list!.items[0].id;

    const result = await completeListItem.handler(
      { listId, itemId, checked: true },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(
      ctx.getCurrentCanvas().sections[0].lists?.[0].items[0].checked,
    ).toBe(true);
  });

  it("returns not-found when the list is not a checklist", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-complete-2", [
      { paragraphs: ["non-task"] },
    ]);
    const convert = await convertToBulletList.handler(
      { sectionId: "section-1", paragraphIds: [paragraphId(0, 0)] },
      ctx,
    );
    const listId = (convert as { ok: true; data: { listId: string } }).data
      .listId;
    const list = ctx.getCurrentCanvas().sections[0].lists?.[0];
    const itemId = list!.items[0].id;
    const result = await completeListItem.handler(
      { listId, itemId, checked: true },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });
});
