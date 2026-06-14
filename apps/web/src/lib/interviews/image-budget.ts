import "server-only";

/**
 * Per-interview image spend budget. Caps how much an interview can
 * spend on AI image generation so a runaway model can't drain the
 * workspace budget through repeated `request_featured_image` calls.
 *
 * The cap is in-process only — sufficient for the typical case where
 * a single interview runs against a single Next.js instance. Cross-
 * instance enforcement happens at the workspace `monthlyCostCapUsd`
 * layer (see `tools/index.ts:checkWorkspaceCostCap`).
 */

/** USD spend cap per interview for image generation. */
export const IMAGE_BUDGET_CAP_USD = 1.0;

/**
 * Conservative per-image cost estimate for `gpt-image-1` at the
 * `high` quality + landscape size used by `generateImage`. Unsplash
 * lookups are free and do not count toward the cap.
 */
export const AI_IMAGE_COST_USD = 0.19;

interface InterviewImageState {
  spentUsd: number;
}

const state = new Map<string, InterviewImageState>();

function getState(interviewId: string): InterviewImageState {
  let s = state.get(interviewId);
  if (!s) {
    s = { spentUsd: 0 };
    state.set(interviewId, s);
  }
  return s;
}

/**
 * Returns `true` if the next AI image would push spend over the cap.
 * Caller should soft-fail with a clear "image budget exceeded" message
 * and skip the upstream call.
 */
export function wouldExceedImageBudget(interviewId: string): boolean {
  const s = getState(interviewId);
  return s.spentUsd + AI_IMAGE_COST_USD > IMAGE_BUDGET_CAP_USD;
}

/** Record a successful AI image generation against the budget. */
export function recordImageSpend(
  interviewId: string,
  costUsd: number = AI_IMAGE_COST_USD,
): void {
  const s = getState(interviewId);
  s.spentUsd += costUsd;
}

/** Read current spend (test + observability). */
export function getImageSpend(interviewId: string): number {
  return state.get(interviewId)?.spentUsd ?? 0;
}

/** Drop per-interview state when the session ends. */
export function clearImageBudget(interviewId: string): void {
  state.delete(interviewId);
}
