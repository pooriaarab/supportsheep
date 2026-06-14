/**
 * Conflict resolution between AI-proposed updates and human edits.
 *
 * The writer-worker streams `section_updated` diffs as the AI refines
 * the canvas. When a human has typed into the editable canvas
 * (TipTap editor) the AI's update for that paragraph would otherwise
 * stomp on the human's work. The current default (writer-worker.ts)
 * is to drop the AI diff entirely whenever the section is in
 * `humanEditedSections` — safe but coarse.
 *
 * This helper offers a finer-grained merge:
 *   1. If the human-edited text still contains the AI's previous
 *      text as a substring, splice the AI's new value in at that
 *      position. Preserves the human's surrounding additions.
 *   2. Otherwise return a `proposed` outcome with the AI's update
 *      attached so the UI can render an "AI proposed change" pill
 *      (accept / reject) instead of either silently dropping the
 *      update or silently overwriting the human.
 *
 * Pure functions only — no React, no Firebase. The writer-worker
 * uses these to decide whether to accept, splice, or stash the AI's
 * diff, and the UI uses the same helpers when reconciling local
 * edits with incoming SSE diffs.
 */

export type MergeOutcome =
  | { kind: "accept"; value: string }
  | { kind: "splice"; value: string }
  | { kind: "proposed"; humanValue: string; aiValue: string };

/**
 * Merge an AI-proposed text update against the current (human-edited)
 * text and the AI's previous text.
 *
 * @param humanValue The text the human currently sees / has typed.
 *   When the paragraph has not been touched this is the AI's prior
 *   value too.
 * @param aiOldValue The text the AI thinks is currently in place
 *   (usually the value of the paragraph the last time the writer
 *   emitted a diff for it).
 * @param aiNewValue The new value the AI wants to use.
 *
 * Resolution order:
 *   - If `humanValue === aiOldValue` the human has not touched this
 *     paragraph since the AI last wrote — accept the AI's update.
 *   - If `humanValue` contains `aiOldValue` as a substring, splice
 *     the AI's new value into that slot. Preserves anything the
 *     human added before/after.
 *   - Otherwise the human rewrote the paragraph from scratch (or
 *     the AI's prior value was empty) — flag the AI update as
 *     `proposed` so the UI can show an accept/reject pill.
 */
export function mergeParagraphEdit(
  humanValue: string,
  aiOldValue: string,
  aiNewValue: string,
): MergeOutcome {
  // No prior AI text means we have nothing to anchor a splice on. If the
  // human value is empty, accept; otherwise propose so the user decides.
  if (!aiOldValue) {
    if (humanValue === "") return { kind: "accept", value: aiNewValue };
    return { kind: "proposed", humanValue, aiValue: aiNewValue };
  }

  if (humanValue === aiOldValue) {
    return { kind: "accept", value: aiNewValue };
  }

  const idx = humanValue.indexOf(aiOldValue);
  if (idx !== -1) {
    const merged =
      humanValue.slice(0, idx) +
      aiNewValue +
      humanValue.slice(idx + aiOldValue.length);
    return { kind: "splice", value: merged };
  }

  return { kind: "proposed", humanValue, aiValue: aiNewValue };
}

/**
 * Render a short, human-readable summary of recent canvas edits for
 * inclusion in the writer-worker's system prompt. Keeps the prompt
 * bounded by truncating each edit value to `maxChars` characters and
 * the overall list to the most recent `maxEntries` items.
 *
 * The format is deliberately compact and unambiguous so the model
 * can reason about which paragraphs are off-limits without us
 * needing to add a structured channel.
 */
export interface HumanEditEntry {
  sectionId: string;
  field: "heading" | "paragraph_text" | "bullet_text";
  index?: number;
  value: string;
  /** Optional — the AI's previous value for this slot, if known. */
  previousValue?: string;
}

export function formatHumanEditsForPrompt(
  edits: HumanEditEntry[],
  opts?: { maxEntries?: number; maxChars?: number },
): string {
  if (edits.length === 0) return "";
  const maxEntries = opts?.maxEntries ?? 5;
  const maxChars = opts?.maxChars ?? 200;
  const recent = edits.slice(-maxEntries);
  const lines = recent.map((e) => {
    const slot =
      e.field === "heading"
        ? `§${e.sectionId} heading`
        : e.field === "paragraph_text"
          ? `§${e.sectionId} p${e.index ?? 0}`
          : `§${e.sectionId} bullet ${e.index ?? 0}`;
    const truncated =
      e.value.length > maxChars ? `${e.value.slice(0, maxChars)}…` : e.value;
    const safe = truncated.replace(/\s+/g, " ").trim();
    return `- ${slot}: ${JSON.stringify(safe)}`;
  });
  return [
    "Recent human edits to the article (DO NOT undo or revert these):",
    ...lines,
    "When emitting diffs, respect the human's wording for the slots above. Do not rewrite them.",
  ].join("\n");
}
