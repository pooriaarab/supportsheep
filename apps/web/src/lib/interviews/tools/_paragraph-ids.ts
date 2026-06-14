import type { CanvasSection, CanvasState, ParagraphAlignment } from "../writer-worker";

/**
 * Mint a globally-unique paragraph id of the form `<sectionId>-p<seq>`.
 * Sequence is monotonically increasing per section — never reused even
 * when the paragraph at that index is later deleted, so prior ids the
 * model cached remain unambiguous.
 *
 * We derive the next seq from the **highest existing id** rather than
 * from `paragraphs.length` precisely because deletes leave gaps in the
 * sequence space. Reusing the gap would let the model accidentally
 * address a freshly inserted paragraph with a stale id.
 */
export function mintParagraphId(section: CanvasSection): string {
  const existing = section.paragraphIds ?? [];
  let maxSeq = -1;
  for (const id of existing) {
    const m = /-p(\d+)$/.exec(id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${section.id}-p${maxSeq + 1}`;
}

/**
 * Ensure parallel arrays exist and are the same length as `paragraphs`.
 * Missing slots are filled with freshly-minted ids / undefined alignment.
 * Idempotent — calling this before any paragraph mutation guarantees
 * the section is in a consistent state without forcing every legacy
 * code path (writer-worker JSON ingest, async stitcher, etc.) to mint
 * ids up-front.
 */
export function ensureParagraphMetadata(section: CanvasSection): void {
  const n = section.paragraphs.length;
  if (!section.paragraphIds) section.paragraphIds = [];
  if (!section.paragraphAlignments) section.paragraphAlignments = [];
  const ids = section.paragraphIds;
  const aligns = section.paragraphAlignments;
  // Truncate if AI refinement shortened the paragraphs array.
  if (ids.length > n) ids.length = n;
  if (aligns.length > n) aligns.length = n;
  // Backfill ids for any paragraphs that don't yet have one.
  // Use mintParagraphId to avoid reusing sequence numbers after deletes.
  while (ids.length < n) {
    ids.push(mintParagraphId(section));
  }
  while (aligns.length < n) {
    aligns.push(undefined);
  }
}

/**
 * Find the (section, paragraphIndex) for a given paragraph id.
 *
 * Tries id-array lookup first (canonical `section-1-p0` format from
 * `mintParagraphId`), then falls back to the legacy `-p-<n>` regex
 * still used by Phase 3 test fixtures (`section-1-p-0`). Both
 * conventions appear in the codebase — keeping them both addressable
 * here is what lets the mark + heading-promotion tools work against
 * fixture-seeded and production canvases without forcing either to
 * change.
 */
export function findParagraph(
  canvas: CanvasState,
  paragraphId: string,
): { section: CanvasSection; index: number } | null {
  for (const section of canvas.sections) {
    ensureParagraphMetadata(section);
    const idx = section.paragraphIds!.indexOf(paragraphId);
    if (idx !== -1) return { section, index: idx };
  }
  // Legacy fallback: `<sectionId>-p-<index>` (fixture format). Only
  // applies when the sectionId prefix matches and the numeric suffix
  // is in bounds of the candidate section's paragraphs.
  const legacy = paragraphId.match(/^(.+)-p-(\d+)$/);
  if (!legacy) return null;
  const [, sectionId, rawIdx] = legacy;
  const idx = Number(rawIdx);
  if (!Number.isInteger(idx) || idx < 0) return null;
  const section = canvas.sections.find((s) => s.id === sectionId);
  if (!section || idx >= section.paragraphs.length) return null;
  return { section, index: idx };
}

export type { ParagraphAlignment };
