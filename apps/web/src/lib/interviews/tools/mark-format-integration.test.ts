import { describe, expect, it } from "vitest";
import applyBold from "./apply-bold";
import applyCode from "./apply-code";
import applyHeadingLevel from "./apply-heading-level";
import applyHighlight from "./apply-highlight";
import applyItalic from "./apply-italic";
import applyStrike from "./apply-strike";
import applyUnderline from "./apply-underline";
import { makePhase3Fixture } from "./_phase3-fixture";
import insertParagraph from "./insert-paragraph";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

/**
 * W25.H regression tests: every mark/heading-change tool must
 *
 *   (a) mutate the canvas state on the worker, and
 *   (b) emit a `section_updated` (or `section_added` for heading
 *       promotion) diff so the connected client actually re-renders.
 *
 * Before this fix, `setParagraphText` mutated state silently and the
 * realtime model would call `apply_bold` etc. with success acks while
 * the user's canvas stayed visually unchanged.
 */
describe("W25.H — mark + heading tools mutate canvas AND emit diffs", () => {
  function collectDiffs(worker: WriterWorker): Array<{ type: string; payload: unknown }> {
    const diffs: Array<{ type: string; payload: unknown }> = [];
    worker.on("diff", (d) =>
      diffs.push(d as { type: string; payload: unknown }),
    );
    return diffs;
  }

  it("apply_bold emits section_updated with the wrapped text", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-bold-emit", [
      { paragraphs: ["Hello world"] },
    ]);
    const diffs = collectDiffs(worker);
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
    const emitted = diffs.find((d) => d.type === "section_updated");
    expect(emitted).toBeDefined();
    const payload = emitted!.payload as {
      id: string;
      paragraphs: string[];
    };
    expect(payload.id).toBe("section-1");
    expect(payload.paragraphs).toEqual(["Hello **world**"]);
  });

  it("apply_italic emits section_updated with the wrapped text", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-italic-emit", [
      { paragraphs: ["plain text"] },
    ]);
    const diffs = collectDiffs(worker);
    const result = await applyItalic.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 5 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "*plain* text",
    );
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });

  it("apply_underline emits section_updated", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-u-emit", [
      { paragraphs: ["date here"] },
    ]);
    const diffs = collectDiffs(worker);
    const result = await applyUnderline.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 4 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "<u>date</u> here",
    );
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });

  it("apply_strike emits section_updated", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-strike-emit", [
      { paragraphs: ["wrong fact"] },
    ]);
    const diffs = collectDiffs(worker);
    const result = await applyStrike.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 0, to: 5 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "~~wrong~~ fact",
    );
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });

  it("apply_code emits section_updated", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-code-emit", [
      { paragraphs: ["call useState here"] },
    ]);
    const diffs = collectDiffs(worker);
    const result = await applyCode.handler(
      {
        sectionId: "section-1",
        paragraphId: paragraphId(0, 0),
        range: { from: 5, to: 13 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "call `useState` here",
    );
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });

  it("apply_highlight emits section_updated with the colour-tagged mark", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-h-emit", [
      { paragraphs: ["key insight here"] },
    ]);
    const diffs = collectDiffs(worker);
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
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });

  it("apply_heading_level promotes a paragraph into a new section heading", async () => {
    const { ctx, worker, paragraphId } = makePhase3Fixture("int-heading-emit", [
      {
        heading: "Origin",
        paragraphs: [
          "Intro line.",
          "Section heading text",
          "Body that follows the heading.",
        ],
      },
    ]);
    const diffs = collectDiffs(worker);
    const result = await applyHeadingLevel.handler(
      {
        paragraphId: paragraphId(0, 1),
        level: 3,
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const canvas = ctx.getCurrentCanvas();
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0].paragraphs).toEqual(["Intro line."]);
    expect(canvas.sections[1].heading).toBe("Section heading text");
    expect(canvas.sections[1].level).toBe(3);
    expect(canvas.sections[1].paragraphs).toEqual([
      "Body that follows the heading.",
    ]);
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
    expect(diffs.some((d) => d.type === "section_added")).toBe(true);
  });

  it("apply_heading_level rejects empty paragraphs", async () => {
    const { ctx, paragraphId } = makePhase3Fixture("int-heading-empty", [
      { paragraphs: ["   "] },
    ]);
    const result = await applyHeadingLevel.handler(
      {
        paragraphId: paragraphId(0, 0),
        level: 2,
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("not-found");
  });

  it("apply_bold resolves paragraph ids minted by insert_paragraph (section-X-pN format)", async () => {
    // Real-canvas flow: add_heading creates a section, insert_paragraph
    // mints an id of the form `section-1-p0` (no second dash). The mark
    // tools must locate the paragraph through this id format too —
    // before W25.H, the `parseParagraphIndex` regex only matched the
    // `-p-<n>` fixture format and silently failed in production.
    const worker = new WriterWorker({ interviewId: "int-real-ids", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-real-ids", worker });
    await addHeading.handler({ text: "Origin" }, ctx);
    const insertResult = await insertParagraph.handler(
      { sectionId: "section-1", text: "Hello world" },
      ctx,
    );
    expect(insertResult.ok).toBe(true);
    const insertedId = (insertResult as { ok: true; data: { paragraphId: string } })
      .data.paragraphId;
    expect(insertedId).toMatch(/^section-1-p\d+$/);

    const diffs = collectDiffs(worker);
    const result = await applyBold.handler(
      {
        sectionId: "section-1",
        paragraphId: insertedId,
        range: { from: 6, to: 11 },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentCanvas().sections[0].paragraphs[0]).toBe(
      "Hello **world**",
    );
    expect(diffs.some((d) => d.type === "section_updated")).toBe(true);
  });
});
