import { WriterWorker, type CanvasSection } from "../writer-worker";
import { buildToolContext } from "./index";

/**
 * Phase 3 tests need paragraphs already on the canvas before applying
 * marks or list conversions. The writer worker's public surface only
 * mutates paragraphs via the (private) AI refinement loop or via
 * `applyCanvasEdit` (which replaces but does not append). For tests
 * we reach into the worker's runtime state directly — kept in a
 * single fixture so the access pattern is documented in one place.
 */
export function makePhase3Fixture(
  interviewId: string,
  seed: Array<{
    heading?: string | null;
    paragraphs?: string[];
  }>,
): {
  worker: WriterWorker;
  ctx: ReturnType<typeof buildToolContext>;
  paragraphId: (sectionIndex: number, paragraphIndex: number) => string;
} {
  const worker = new WriterWorker({ interviewId, apiKey: "test-key" });
  const internal = worker as unknown as { state: { sections: CanvasSection[] } };
  for (let i = 0; i < seed.length; i++) {
    const cfg = seed[i];
    internal.state.sections.push({
      id: `section-${i + 1}`,
      heading: cfg.heading ?? null,
      bullets: [],
      paragraphs: cfg.paragraphs ?? [],
      quotes: [],
      finalized: false,
    });
  }
  const ctx = buildToolContext({ interviewId, worker });
  const paragraphId = (sectionIndex: number, paragraphIndex: number) =>
    `section-${sectionIndex + 1}-p-${paragraphIndex}`;
  return { worker, ctx, paragraphId };
}
