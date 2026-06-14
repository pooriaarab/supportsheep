/**
 * Shared types and the pure reducer for the bidirectional guide-note chat
 * log surfaced in the "Guiding the Writer" panel. Kept here (instead of
 * inline in the hook) so the cap-and-append logic is unit-testable without
 * booting React.
 */

export type ChatTurnRole = "user" | "ai";

export interface ChatTurn {
  /** Stable key for React reconciliation, unique per appended turn. */
  id: string;
  /** Sender of the turn. User turns are sent guide notes; AI turns are the
   *  final transcript of an AI response. */
  role: ChatTurnRole;
  /** Display text for the row. Empty strings are filtered out by the
   *  reducer because blank rows carry no information. */
  text: string;
  /** Epoch ms the turn was observed locally — used for the relative
   *  timestamp and for ordering when two turns arrive in the same tick. */
  timestamp: number;
}

/** Hard cap on `chatTurns` length. A 30-minute interview can produce dozens
 *  of turns; we keep the most recent 50 so the panel stays responsive
 *  without unbounded DOM growth. */
export const CHAT_TURNS_MAX_ENTRIES = 50;

let chatTurnSeq = 0;

/**
 * Pure reducer: append a new turn and enforce the rolling cap. Drops turns
 * with blank text so the UI never renders empty rows. Returns the original
 * array reference when no append happens, so React `useState` doesn't
 * trigger spurious re-renders.
 */
export function appendChatTurn(
  prev: ChatTurn[],
  next: { role: ChatTurnRole; text: string; timestamp: number },
): ChatTurn[] {
  const trimmed = next.text?.trim() ?? "";
  if (trimmed.length === 0) return prev;
  chatTurnSeq += 1;
  const entry: ChatTurn = {
    id: `${next.role}-${next.timestamp}-${chatTurnSeq}`,
    role: next.role,
    text: trimmed,
    timestamp: next.timestamp,
  };
  const appended = [...prev, entry];
  if (appended.length > CHAT_TURNS_MAX_ENTRIES) {
    return appended.slice(appended.length - CHAT_TURNS_MAX_ENTRIES);
  }
  return appended;
}
