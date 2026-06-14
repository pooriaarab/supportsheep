import { describe, expect, it, vi } from "vitest";
import { WriterWorker, type WriterDiff } from "./writer-worker";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
  withStructuredLog: async (
    _log: unknown,
    _operation: string,
    _context: Record<string, unknown>,
    fn: () => Promise<unknown>,
  ) => fn(),
}));

/**
 * Phase 2 integration coverage for destructive structural ops. The
 * per-tool unit tests assert handler return-value semantics; these
 * tests pin the resulting `CanvasState` shape + diff stream so we
 * notice any future refactor that breaks the canvas contract.
 */
describe("WriterWorker — Phase 2 destructive section ops", () => {
  it("delete_section drops the section from canvas + emits section_removed", () => {
    const worker = new WriterWorker({ interviewId: "int-d", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Keep" });
    worker.applyToolCall("add_heading", { text: "Drop" });
    worker.applyToolCall("add_bullet", { text: "Drop bullet" });

    const before = worker.getCanvas();
    expect(before.sections.map((s) => s.id)).toEqual([
      "section-1",
      "section-2",
    ]);

    const diffs: WriterDiff[] = [];
    worker.on("diff", (d: WriterDiff) => diffs.push(d));

    worker.applyToolCall("delete_section", { sectionId: "section-2" });

    const after = worker.getCanvas();
    expect(after.sections).toHaveLength(1);
    expect(after.sections[0].id).toBe("section-1");
    expect(after.sections[0].heading).toBe("Keep");
    expect(diffs).toEqual([
      { type: "section_removed", payload: { sectionId: "section-2" } },
    ]);
  });

  it("merge_sections concatenates content into the target + deletes source", () => {
    const worker = new WriterWorker({ interviewId: "int-m", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Into" });
    worker.applyToolCall("add_bullet", { text: "into-1" });
    worker.applyToolCall("add_heading", { text: "From" });
    worker.applyToolCall("add_bullet", { text: "from-1" });
    worker.applyToolCall("add_bullet", { text: "from-2" });
    worker.applyToolCall("add_quote", { text: "q", attributedTo: "Speaker" });

    const diffs: WriterDiff[] = [];
    worker.on("diff", (d: WriterDiff) => diffs.push(d));

    worker.applyToolCall("merge_sections", {
      fromSectionId: "section-2",
      intoSectionId: "section-1",
    });

    const after = worker.getCanvas();
    expect(after.sections).toHaveLength(1);
    const survivor = after.sections[0];
    expect(survivor.id).toBe("section-1");
    expect(survivor.heading).toBe("Into");
    expect(survivor.bullets).toEqual(["into-1", "from-1", "from-2"]);
    expect(survivor.quotes).toEqual([{ text: "q", attributedTo: "Speaker" }]);

    // Two diffs: section_merged then a follow-up section_updated for the
    // survivor so SSE consumers can refresh their cached section view.
    expect(diffs.map((d) => d.type)).toEqual([
      "section_merged",
      "section_updated",
    ]);
    expect(diffs[0].payload).toEqual({
      fromSectionId: "section-2",
      intoSectionId: "section-1",
    });
  });

  it("move_section reorders and emits sections_reordered with new id order", () => {
    const worker = new WriterWorker({ interviewId: "int-r", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "A" });
    worker.applyToolCall("add_heading", { text: "B" });
    worker.applyToolCall("add_heading", { text: "C" });

    const diffs: WriterDiff[] = [];
    worker.on("diff", (d: WriterDiff) => diffs.push(d));

    // Move "C" to index 0 → [C, A, B]
    worker.applyToolCall("move_section", {
      sectionId: "section-3",
      toIndex: 0,
    });

    const order = worker.getCanvas().sections.map((s) => s.id);
    expect(order).toEqual(["section-3", "section-1", "section-2"]);
    expect(diffs).toEqual([
      {
        type: "sections_reordered",
        payload: { sectionIds: ["section-3", "section-1", "section-2"] },
      },
    ]);
  });

  it("insert_section after a target id preserves monotonic ids", () => {
    const worker = new WriterWorker({ interviewId: "int-i", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "A" });
    worker.applyToolCall("add_heading", { text: "B" });
    worker.applyToolCall("insert_section", {
      heading: "AB",
      afterSectionId: "section-1",
      level: 3,
    });
    const order = worker.getCanvas().sections.map((s) => s.id);
    expect(order).toEqual(["section-1", "section-3", "section-2"]);
    expect(worker.getCanvas().sections[1].level).toBe(3);
  });

  it("title/meta tools land on the canvas state in the expected fields", () => {
    const worker = new WriterWorker({ interviewId: "int-t", apiKey: "k" });
    worker.applyToolCall("set_title", { title: "T" });
    worker.applyToolCall("set_subtitle", { subtitle: "S" });
    worker.applyToolCall("set_slug", { slug: "t-slug" });
    worker.applyToolCall("set_seo_meta", {
      metaTitle: "MT",
      metaDescription: "MD",
    });

    const c = worker.getCanvas();
    expect(c.title).toBe("T");
    expect(c.subtitle).toBe("S");
    expect(c.slug).toBe("t-slug");
    expect(c.metaTitle).toBe("MT");
    expect(c.metaDescription).toBe("MD");
  });
});
