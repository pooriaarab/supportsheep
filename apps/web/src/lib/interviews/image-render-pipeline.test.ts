/**
 * Integration regression test for W26.A: AI-generated images MUST render in
 * the in-call TipTap editor HTML within one applyDiff tick — not just on
 * the post-call /review preview.
 *
 * User-visible bug: the AI calls `insert_inline_image` /
 * `request_featured_image`, the generation succeeds, and the image lands
 * on the saved-draft preview at `/review`, but the live in-call canvas
 * stays empty. PR #335 (W24.K) fixed the inline-image leg of the pipeline
 * by teaching `canvasToTiptap` to emit `figure` nodes from
 * `section.inlineImages`. This test pins both legs end-to-end so a future
 * regression on either path fails loudly:
 *
 *   1. Server: `worker.insertInlineImage(...)` / `worker.setFeaturedImage(...)`
 *      mutates state + emits an `inline_image_added` /
 *      `featured_image_updated` diff (writer-worker.ts).
 *   2. Client: `applyDiff` mutates `canvas.sections[i].inlineImages[]` /
 *      `canvas.featuredImage`.
 *   3. Render: `canvasToHtml(canvas)` produces HTML containing an `<img>`
 *      tag wrapped in a `<figure>` — exactly the HTML the TipTap editor
 *      `setContent`s into the in-call canvas.
 *
 * A green test here proves the full chain carries the image URL into the
 * live editor. A red test localises whether the regression is on the
 * worker side (no diff emit), the client side (diff dropped or
 * inlineImages stripped from the section payload), or the renderer
 * (figure node missing from the TipTap doc).
 */

// @vitest-environment happy-dom

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { canvasToHtml } from "@/lib/interviews/canvas-to-html";
import {
  applyDiff,
  type CanvasState,
} from "@/hooks/use-interview-session";
import { WriterWorker } from "@/lib/interviews/writer-worker";

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

describe("W26.A: AI image tool → in-call editor renders <img> end-to-end", () => {
  it("insert_inline_image yields a <figure><img/></figure> in the in-call canvas HTML", async () => {
    const worker = new WriterWorker({
      interviewId: "int-w26a-1",
      client: stubClient,
    });
    const emittedDiffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((d) =>
      emittedDiffs.push(d as { type: string; payload: unknown }),
    );

    // 1. AI mints a section, then calls insert_inline_image against it.
    worker.applyToolCall("add_heading", { text: "Practice" });
    const sectionId = worker.getCanvas().sections[0].id;
    const inserted = worker.insertInlineImage({
      sectionId,
      url: "https://example.com/zen-monk.png",
      alt: "zen monk meditating",
      source: "ai",
    });
    expect(inserted).not.toBeNull();

    // 2. Wait for one render cycle (~200ms — well under the SSE round-trip
    //    budget) so any deferred diff emission would have already landed.
    //    The worker emits synchronously today, but this keeps the test
    //    honest if a future refactor introduces a microtask between
    //    `insertInlineImage` and the diff fan-out.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Replay every emitted diff through the client applyDiff to mirror
    //    the SSE bridge.
    const { setter, get } = mkSetter(emptyCanvas());
    for (const d of emittedDiffs) {
      applyDiff(
        setter,
        d as { type: string; payload: Record<string, unknown> },
      );
    }

    // 4. Client canvas MUST hold the image in section.inlineImages.
    const finalCanvas = get();
    expect(finalCanvas.sections[0].inlineImages?.[0]?.url).toBe(
      "https://example.com/zen-monk.png",
    );

    // 5. canvasToHtml MUST emit an <img> tag with the right src — what the
    //    TipTap editor `setContent`s into the live canvas. Without the
    //    figure-node branch in canvas-to-tiptap.ts the diff would land on
    //    state but never reach the editor DOM.
    const html = canvasToHtml(finalCanvas);
    expect(html).toContain('<img src="https://example.com/zen-monk.png"');
    expect(html).toMatch(/<figure[^>]*>[\s\S]*<img[^>]+src="https:\/\/example\.com\/zen-monk\.png"/);
  });

  it("request_featured_image (set via setFeaturedImage) renders an <img> in the in-call canvas HTML", async () => {
    const worker = new WriterWorker({
      interviewId: "int-w26a-2",
      client: stubClient,
    });
    const emittedDiffs: Array<{ type: string; payload: unknown }> = [];
    worker.subscribe((d) =>
      emittedDiffs.push(d as { type: string; payload: unknown }),
    );

    // AI sets the title then asks for a featured image — same shape the
    // background `request_featured_image` worker uses once Unsplash / the
    // AI provider hands back a URL.
    worker.applyToolCall("set_title", { title: "Mindful Mornings" });
    worker.setFeaturedImage({
      url: "https://example.com/hero.png",
      alt: "sunrise over mountains",
      source: "ai",
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const { setter, get } = mkSetter(emptyCanvas());
    for (const d of emittedDiffs) {
      applyDiff(
        setter,
        d as { type: string; payload: Record<string, unknown> },
      );
    }

    const finalCanvas = get();
    expect(finalCanvas.featuredImage?.url).toBe("https://example.com/hero.png");

    // The featured image MUST render in the live in-call HTML, not just on
    // the /review preview — this is the W26.A regression.
    const html = canvasToHtml(finalCanvas);
    expect(html).toContain('<img src="https://example.com/hero.png"');
  });
});
