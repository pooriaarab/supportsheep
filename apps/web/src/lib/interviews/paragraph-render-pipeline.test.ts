/**
 * Integration regression test for W23.D: paragraphs from the realtime AI's
 * `insert_paragraph` tool call MUST render in the editor's prose within one
 * applyDiff tick.
 *
 * The user-visible bug from the W22 walkthrough: AI verbally says "the
 * opening statement is there", the H1 title and H2 heading appear, but the
 * paragraphs the AI claims to have written never render. This test pins
 * the full pipeline:
 *
 *   1. AI calls `insert_paragraph` (server: tools/insert-paragraph.ts)
 *   2. Server `worker.insertParagraph(...)` mutates state + emits a
 *      synthetic `section_updated` diff (writer-worker.ts emitParagraphDiff)
 *   3. The diff travels over Firestore → SSE (out of scope here — covered
 *      by stream/route.test.ts); we route the diff straight into the
 *      client's `applyDiff` to keep the integration tight.
 *   4. Client `applyDiff` mutates `canvas.sections[i].paragraphs[]`
 *   5. `canvasToHtml(canvas)` produces HTML containing the paragraph text
 *      wrapped in a `<p>` node — what the TipTap editor `setContent`s.
 *
 * A green test here proves the pipeline carries paragraph text end-to-end.
 * A red test localises the broken step: the worker emit branch (step 2),
 * the client applyDiff branch (step 4), or the renderer (step 5).
 */

// @vitest-environment happy-dom

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { canvasToHtml } from "@/lib/interviews/canvas-to-html";
import {
  applyDiff,
  type CanvasSection,
  type CanvasState,
} from "@/hooks/use-interview-session";
import { WriterWorker } from "@/lib/interviews/writer-worker";

/**
 * Stub Anthropic client — happy-dom puts the SDK in "browser" mode where
 * it refuses to spawn without `dangerouslyAllowBrowser`. Pass a stub so
 * the worker never constructs the real client.
 */
const stubClient = { messages: { create: vi.fn() } } as unknown as Anthropic;

vi.mock("@/lib/db", () => ({
  collections: {
    interviews: () => ({
      doc: () => ({
        collection: () => ({
          add: vi.fn().mockResolvedValue({ id: "evt-1" }),
        }),
      }),
    }),
  },
  FieldValue: { serverTimestamp: () => "ts" },
}));

function emptyCanvas(): CanvasState {
  return {
    title: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  };
}

function mkSetter(initial: CanvasState) {
  let state = initial;
  const setter = ((updater: CanvasState | ((p: CanvasState) => CanvasState)) => {
    state = typeof updater === "function"
      ? (updater as (p: CanvasState) => CanvasState)(state)
      : updater;
  }) as React.Dispatch<React.SetStateAction<CanvasState>>;
  return { setter, get: () => state };
}

describe("W23.D: AI insert_paragraph → editor renders paragraph end-to-end", () => {
  it("a single insert_paragraph tool call yields a <p>-wrapped paragraph in canvasToHtml", () => {
    // 1. Capture every diff the worker emits from this point on — order
    //    matters, so subscribe BEFORE the first mutating call.
    const worker = new WriterWorker({ interviewId: "int-w23d-1", client: stubClient });
    const emittedDiffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((d) => emittedDiffs.push(d as { type: string; payload: unknown }));

    // 2. Realtime AI mints a section via `add_heading`, then fires
    //    `insert_paragraph` against the freshly-returned id.
    worker.applyToolCall("add_heading", { text: "Intro" });
    const sectionId = worker.getCanvas().sections[0].id;
    const result = worker.insertParagraph({
      sectionId,
      text: "The opening statement of our story.",
    });
    expect(result.ok).toBe(true);

    // 3. Replay every emitted diff through the client to mirror what the
    //    SSE bridge would deliver. After the replay the client canvas MUST
    //    hold the paragraph in `sections[0].paragraphs`.
    const { setter, get } = mkSetter(emptyCanvas());
    for (const d of emittedDiffs) {
      applyDiff(setter, d as { type: string; payload: Record<string, unknown> });
    }
    const finalCanvas = get();
    expect(finalCanvas.sections[0].paragraphs).toEqual([
      "The opening statement of our story.",
    ]);

    // 4. canvasToHtml renders the paragraph inside a <p> node — the exact
    //    HTML the TipTap editor `setContent`s into the in-call canvas.
    const html = canvasToHtml(finalCanvas);
    expect(html).toContain("<p>The opening statement of our story.</p>");
  });

  it("two consecutive insert_paragraph calls both land in the same section and both render", () => {
    const worker = new WriterWorker({ interviewId: "int-w23d-2", client: stubClient });
    const emittedDiffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((d) => emittedDiffs.push(d as { type: string; payload: unknown }));

    worker.applyToolCall("add_heading", { text: "Body" });
    const sectionId = worker.getCanvas().sections[0].id;
    worker.insertParagraph({ sectionId, text: "First paragraph." });
    worker.insertParagraph({ sectionId, text: "Second paragraph." });

    // Replay every emit through the client to mirror the SSE delivery order.
    const { setter, get } = mkSetter(emptyCanvas());
    for (const d of emittedDiffs) {
      applyDiff(setter, d as { type: string; payload: Record<string, unknown> });
    }

    const sec = get().sections[0];
    expect(sec.paragraphs).toEqual(["First paragraph.", "Second paragraph."]);

    const html = canvasToHtml(get());
    expect(html).toContain("<p>First paragraph.</p>");
    expect(html).toContain("<p>Second paragraph.</p>");
  });

  it("an `upsert_paragraph` LLM-refinement diff (W22.A path) also renders into the editor HTML", () => {
    // Hydrate a section with one paragraph already in place.
    const { setter, get } = mkSetter({
      ...emptyCanvas(),
      sections: [
        {
          id: "s-1",
          heading: "Refined section",
          bullets: [],
          paragraphs: [],
          paragraphIds: [],
          quotes: [],
          finalized: false,
        } satisfies CanvasSection,
      ],
    });

    // Writer-worker LLM refinement emits this diff shape.
    applyDiff(setter, {
      type: "upsert_paragraph",
      payload: {
        sectionId: "s-1",
        paragraphId: "s-1-p-0",
        text: "Polished prose from the refinement pass.",
      },
    });

    expect(get().sections[0].paragraphs).toEqual([
      "Polished prose from the refinement pass.",
    ]);

    const html = canvasToHtml(get());
    expect(html).toContain(
      "<p>Polished prose from the refinement pass.</p>",
    );
  });

  it("emitParagraphDiff carries paragraphIds so a follow-up upsert_paragraph refinement updates in place (no duplicate)", () => {
    // Regression for W23.D: the realtime `insert_paragraph` tool used to
    // emit only `{id, paragraphs}` — no `paragraphIds`. The client kept
    // its own paragraphIds array empty, so when the refinement LLM
    // followed up with `upsert_paragraph` keyed on the realtime-minted
    // paragraph id, the client treated it as a NEW paragraph and pushed
    // a duplicate into the section. The end-to-end symptom was "the AI
    // says it polished the opening but I see the same line twice."
    const worker = new WriterWorker({ interviewId: "int-w23d-3", client: stubClient });
    const emittedDiffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((d) => emittedDiffs.push(d as { type: string; payload: unknown }));

    worker.applyToolCall("add_heading", { text: "Intro" });
    const sectionId = worker.getCanvas().sections[0].id;
    const insert = worker.insertParagraph({ sectionId, text: "Rough draft." });
    expect(insert.ok).toBe(true);
    const paragraphId = (insert as { ok: true; paragraphId: string }).paragraphId;

    const { setter, get } = mkSetter(emptyCanvas());
    for (const d of emittedDiffs) {
      applyDiff(setter, d as { type: string; payload: Record<string, unknown> });
    }

    // The paragraph id minted server-side MUST land on the client. Without
    // it, the next upsert_paragraph diff would push a duplicate.
    expect(get().sections[0].paragraphIds).toEqual([paragraphId]);

    // Now simulate the writer-worker refinement upgrading the rough draft.
    applyDiff(setter, {
      type: "upsert_paragraph",
      payload: { sectionId, paragraphId, text: "Polished opening." },
    });

    // The paragraph is REPLACED, not appended.
    expect(get().sections[0].paragraphs).toEqual(["Polished opening."]);
    expect(get().sections[0].paragraphIds).toEqual([paragraphId]);

    const html = canvasToHtml(get());
    expect(html).toContain("<p>Polished opening.</p>");
    expect(html).not.toContain("<p>Rough draft.</p>");
  });

  it("a section_added followed by section_updated containing paragraphs both render the heading AND the paragraph", () => {
    // Simulates the literal bug report: H1 title + H2 heading appear, but
    // the paragraph the AI claims to have added does NOT. If this test
    // ever regresses, the pipeline dropped the section_updated payload's
    // paragraphs field.
    const { setter, get } = mkSetter({ ...emptyCanvas(), title: "My Article" });

    applyDiff(setter, {
      type: "section_added",
      payload: {
        id: "section-1",
        heading: "Definition and Origin",
        bullets: [],
        paragraphs: [],
        quotes: [],
        finalized: false,
      },
    });

    applyDiff(setter, {
      type: "section_updated",
      payload: {
        id: "section-1",
        paragraphs: ["The story begins with one quiet morning."],
      },
    });

    const html = canvasToHtml(get());
    expect(html).toMatch(/<h1[^>]*>My Article<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Definition and Origin<\/h2>/);
    expect(html).toContain(
      "<p>The story begins with one quiet morning.</p>",
    );
  });
});
