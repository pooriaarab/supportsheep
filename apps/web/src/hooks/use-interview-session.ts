"use client";

import { useRef, useState, useCallback } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useLatestRef } from "@/hooks/use-latest-ref";
import {
  RealtimeClient,
  type RealtimeClientState,
  type RealtimeConversationState,
} from "@/lib/interviews/realtime-client";
import {
  appendChatTurn,
  type ChatTurn,
} from "@/lib/interviews/chat-turns";
import {
  fetchSessionLockStatus,
  generateHeartbeatId,
  startSessionLockHeartbeat,
  type SessionLockController,
} from "@/lib/interviews/session-lock";
import { labelForTool } from "@/lib/interviews/tool-labels";
import { createLogger } from "@/lib/logger";

const log = createLogger("hooks:use-interview-session");

/** Hard-coded ceiling for how long the client will wait for the AI's first
 * audio turn after the connection lands `live`. Beyond this point the
 * greeting is almost certainly missing — surface a warning so production
 * regressions in the system-prompt greeting directive are visible in
 * gcloud without needing a live QA pass. Five seconds is conservative
 * (real first-token latency is typically <2s) and far short of the orb's
 * own reconnect/error timeouts. */
const AI_GREETING_TIMEOUT_MS = 5_000;

// Client-side log channel for boot-time greeting visibility. Kept distinct
// from the hook-context logger so ops can filter on
// `interviews:client ai_greeting_timeout` without sweeping the entire
// hook's chatty per-turn log stream.
const clientLog = createLogger("interviews:client");

// SSE reconnect policy. EventSource has a built-in auto-reconnect, but it
// gives no control over backoff or max retries. We disable it by closing the
// instance on error and rebuilding it ourselves with exponential backoff plus
// jitter. After SSE_MAX_RETRIES consecutive failed attempts we stop trying and
// surface the error to the UI instead of looping forever.
const SSE_BACKOFF_MS = [250, 500, 1_000, 2_000, 5_000] as const;
const SSE_MAX_RETRIES = 8;
const SSE_JITTER_MS = 250;

/**
 * First-connect grace window. The first few reconnect cycles right after
 * mount are almost always a benign cookie-attach race (SameSite=Lax cookies
 * from a magic-link nav can miss the very first same-site EventSource —
 * see `buildInterviewTokenCookie`'s threat-model comment). Within this
 * window we still back off + retry, but log at DEBUG instead of WARN so
 * a healthy connect-after-one-blip doesn't pollute ops dashboards with
 * "SSE stream lost" warnings that resolve themselves in <2s.
 */
const SSE_FIRST_CONNECT_GRACE_RETRIES = 3;
const SSE_FIRST_CONNECT_GRACE_MS = 2_000;

function sseBackoffDelay(attempt: number): number {
  const idx = Math.min(attempt, SSE_BACKOFF_MS.length - 1);
  const base = SSE_BACKOFF_MS[idx];
  return base + Math.floor(Math.random() * SSE_JITTER_MS);
}

/**
 * Structured payload the server emits on auth-failure / lock-stale close
 * paths via `event: error`. `retryable` drives the client's decision: keep
 * the existing backoff loop running (cookie race, transient lock contention)
 * or surface the failure to the UI immediately (forged/expired token,
 * cross-interview cookie).
 */
interface SseServerErrorPayload {
  reason: string;
  code?: number;
  retryable?: boolean;
}

// EventSource readyState constants are not always exposed in non-DOM test
// environments — alias them by their numeric values for safe logging.
const SSE_READY_STATE: Record<number, "connecting" | "open" | "closed"> = {
  0: "connecting",
  1: "open",
  2: "closed",
};

type OrbState = "idle" | "listening" | "speaking" | "thinking" | "error" | "muted";

interface UseInterviewSessionInput {
  interviewId: string;
  ephemeralOpenAiToken: string;
  /**
   * Optional microphone deviceId selected in the pre-call device picker.
   * Passed straight to RealtimeClient so the WebRTC mic capture pins to the
   * guest's chosen input instead of the OS default. When undefined the
   * realtime client falls back to the browser default.
   */
  audioInputDeviceId?: string;
  /**
   * Optional callback fired when the realtime model invokes the
   * `end_interview` tool (the AI's response to the user saying "end the
   * interview", "wrap up", etc.). The consumer is expected to drive the
   * same /end POST + navigate flow the End Session button uses — keeping
   * the navigation primitives in the component layer rather than this
   * hook. Always invoked via a fresh-reference latch (`useLatestRef`) so
   * the callback never goes stale across re-renders.
   */
  onEndRequested?: () => void;
}

/**
 * The interview HMAC token is no longer threaded through this hook's
 * input — it lives in an HttpOnly cookie scoped to
 * `/api/v1/interviews/<id>` (see `buildInterviewTokenCookie`). The
 * browser attaches it automatically to every same-origin fetch /
 * EventSource below; we use `credentials: "same-origin"` defensively to
 * make that contract explicit even though it is the default for
 * same-origin requests.
 */

/**
 * Discriminated union of block-level canvas content beyond the
 * standard bullets/paragraphs/quotes — added by Phase 4 tools
 * (blockquotes, code blocks, callouts, dividers, tables) and the
 * generic embed kinds (YouTube/Tweet/Iframe/CodePen/Gist/Loom).
 *
 * Keep in sync with `CanvasBlock` in `lib/interviews/writer-worker.ts`.
 */
export type CanvasBlock =
  | { id: string; type: "blockquote"; text: string; attribution?: string }
  | { id: string; type: "code_block"; language: string; code: string }
  | {
      id: string;
      type: "callout";
      kind: "info" | "warning" | "success" | "danger";
      title?: string;
      body: string;
    }
  | { id: string; type: "divider" }
  | {
      id: string;
      type: "table";
      rows: number;
      cols: number;
      headers?: string[];
    }
  | {
      id: string;
      type: "embed";
      kind: "youtube" | "tweet" | "iframe" | "codepen" | "gist" | "loom";
      src: string;
      attrs?: Record<string, unknown>;
    };

/**
 * List block (bullet / numbered / checklist) attached to a section by
 * Phase 3 list tools. Shape mirrors `CanvasList` in
 * `lib/interviews/writer-worker.ts` — keep in sync when the server
 * model evolves so the SSE diff payloads round-trip cleanly.
 */
export interface CanvasListItem {
  id: string;
  text: string;
  checked?: boolean;
  level: number;
}

export interface CanvasList {
  id: string;
  kind: "bullet" | "numbered" | "checklist";
  items: CanvasListItem[];
}

/**
 * SEO score block surfaced to the sidebar via `request_seo_score`.
 * Shape mirrors `CanvasSeoScore` in `lib/interviews/writer-worker.ts`.
 */
export interface CanvasSeoScore {
  score: number;
  issues: string[];
  suggestions: string[];
  scoredAt: string;
}

/**
 * Internal-link suggestion from `suggest_internal_links`. Shape
 * mirrors `CanvasInternalLinkSuggestion` in
 * `lib/interviews/writer-worker.ts`.
 */
export interface CanvasInternalLinkSuggestion {
  phrase: string;
  targetSlug: string;
  reason: string;
}

export interface CanvasSection {
  id: string;
  heading: string | null;
  bullets: string[];
  paragraphs: string[];
  quotes: Array<{ text: string; attributedTo: string }>;
  blocks?: CanvasBlock[];
  /** Phase 3 list blocks — populated by `convert_to_*_list` tools. */
  lists?: CanvasList[];
  /** Inline images attached to this section — populated by Phase 5 image tools. */
  inlineImages?: CanvasImage[];
  /** Internal links applied to this section via `add_internal_link`. */
  internalLinks?: Array<{
    paragraphId: string;
    range: { start: number; end: number };
    targetSlug: string;
  }>;
  finalized?: boolean;
  /**
   * Stable per-paragraph identifiers parallel to `paragraphs[]`. Populated
   * by the `upsert_paragraph` writer-worker refinement diff and by the
   * realtime paragraph tools server-side. Optional so legacy canvases
   * (no paragraph-level addressing) keep round-tripping.
   */
  paragraphIds?: string[];
}

/**
 * Image attached to the canvas — currently surfaced for the featured/hero
 * image emitted by `request_featured_image` / `regenerate_featured_image`.
 * Keep in sync with `CanvasImage` in `lib/interviews/writer-worker.ts`.
 */
export interface CanvasImage {
  id: string;
  url: string;
  alt: string;
  prompt?: string;
  placement:
    | { kind: "featured" }
    | { kind: "inline"; sectionId: string; afterParagraphIndex?: number };
}

export interface CanvasState {
  title: string | null;
  /**
   * Optional Phase 2 title-adjacent fields. Nullable so a session that
   * never invoked `set_subtitle` / `set_slug` / `set_seo_meta` still
   * round-trips through the SSE pipeline without losing its existing
   * canvas snapshot shape. Keep in sync with `CanvasState` in
   * `lib/interviews/writer-worker.ts`.
   */
  subtitle?: string | null;
  slug?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  sections: CanvasSection[];
  meta: {
    description: string | null;
    tags: string[];
    suggestedCategory: string | null;
  };
  /**
   * Hero image populated by the `featured_image_updated` writer diff.
   * Undefined until the AI requests an image; null when explicitly cleared.
   */
  featuredImage?: CanvasImage | null;
  /** SEO keyword list — populated by `keywords_updated`. */
  keywords?: string[];
  /** Category ids — populated by `categories_updated`. */
  categories?: string[];
  /** Tag names — populated by `tags_updated`. */
  tags?: string[];
  /** Most recent SEO score — populated by `seo_score_updated`. */
  seoScore?: CanvasSeoScore | null;
  /** Internal-link suggestions — populated by `internal_link_suggestions_updated`. */
  internalLinkSuggestions?: CanvasInternalLinkSuggestion[];
}

interface EventLog {
  ts: string;
  kind: "transcript_user" | "transcript_ai" | "chat_input" | "attachment" | "tool_call" | "canvas_update" | "writer_update" | "error";
  payload: unknown;
}

/** Writer is considered "actively appending" if a content-producing diff arrived
 * within this many milliseconds. Controls cursor + typing-sound visibility. */
const WRITER_ACTIVE_TIMEOUT_MS = 1500;

/** Tool-call activity rows older than this auto-evict from `recentToolCalls`
 * so a long 30-minute interview doesn't pile up hundreds of stale entries in
 * the live feed. Tuned to ~30s so a tool call has time to read but does not
 * linger after the AI has moved on. */
const TOOL_CALL_TTL_MS = 30_000;

/** Hard cap on `recentToolCalls` length. Even within the TTL window a noisy
 * model can fire dozens of tool calls — capping protects render cost. */
const TOOL_CALL_MAX_ENTRIES = 20;

/**
 * Narration-cue dedup window. After every SSE reconnect the server replays
 * every event the client missed (including `tool_result`, `tool_in_flight`,
 * and `tool_completed`), which under the production "drops every ~30 s"
 * loop could flood the realtime data channel with N copies of the same cue
 * in a few milliseconds. Dropping a cue whose text was already pushed
 * inside this window protects the AI's data channel from a replay storm
 * without compromising the cue's original purpose — the realtime model
 * already received the first copy. 500 ms is short enough that two
 * genuinely-separate tool dispatches will still both narrate, but long
 * enough to absorb an entire replay batch on a healthy reconnect.
 *
 * Exported so unit tests can read the same constant the hook uses; if it
 * changes, the test moves in lockstep.
 */
export const NARRATION_CUE_DEDUP_WINDOW_MS = 500;

/**
 * Pure dedup helper for narration cues — extracted so the dedup contract
 * can be unit-tested without booting the realtime client, EventSource, and
 * SSR machinery. Returns `true` when the cue should be forwarded, `false`
 * when it must be dropped as a duplicate within the dedup window.
 *
 * Mutates `state` in-place: records `now` as the last-seen timestamp for
 * `dedupKey` and prunes entries older than the window so a long-running
 * session does not slowly grow the map without bound.
 *
 * Caller is responsible for providing a stable `dedupKey` that uniquely
 * identifies the cue text — the hook uses `${kind}:${text}` so identical
 * server-replayed cues collide while two genuinely-different dispatches
 * (different tool, different summary) do not.
 */
export function shouldForwardNarrationCue(
  state: Map<string, number>,
  dedupKey: string,
  now: number,
  windowMs: number = NARRATION_CUE_DEDUP_WINDOW_MS,
): boolean {
  const lastSeen = state.get(dedupKey);
  if (lastSeen !== undefined && now - lastSeen < windowMs) {
    return false;
  }
  // Prune entries older than the window before recording so the map stays
  // bounded by the working set of distinct cues, not the lifetime count.
  for (const [key, ts] of state) {
    if (now - ts >= windowMs) state.delete(key);
  }
  state.set(dedupKey, now);
  return true;
}

/** A single tool invocation observed on the SSE stream. The UI renders the
 * most recent rows as a small "live activity" feed so the user can see what
 * the AI is doing (set_title, insert_section, replace_text, …) instead of
 * just a static spinner. */
export interface ToolCallActivity {
  /** Synthetic stable key for React reconciliation. Combines the upstream
   * call id (if present) with the timestamp so distinct invocations of the
   * same tool don't collapse into one row. */
  key: string;
  /** Tool name as dispatched server-side (e.g. `set_title`, `insert_section`). */
  name: string;
  /** Optional human-friendly suffix derived from arguments — e.g. the section
   * heading for `insert_section`, the field name for `replace_text`. Empty
   * when no useful summary can be derived. */
  label: string;
  /** "applied" for a successful `tool_call`, "failed" for `tool_failed`. */
  status: "applied" | "failed";
  /** Error message surfaced by the dispatcher on `tool_failed`. */
  errorMessage?: string;
  /** Epoch ms when the event was observed locally. Drives both the TTL
   * eviction and the rendered "Xs ago" / "now" relative timestamp. */
  observedAt: number;
}

export interface WriterActivity {
  /** True while the writer-worker is actively appending content (diff in last
   *  ~1.5s). Drives the blinking cursor + typing sound. */
  isAppending: boolean;
  /** ID of the section that received the most recent content delta — the
   *  blinking cursor renders at the end of that section. Null if no content
   *  has streamed yet. */
  lastWriteSectionId: string | null;
  /** True when a section has been scaffolded but has no heading/bullets/
   *  paragraphs/quotes yet — used to show the section skeleton placeholder. */
  hasEmptyTrailingSection: boolean;
}

/**
 * State machine for the single-active-session lock. The hook starts in
 * `checking` while it polls the server for an existing lock; transitions to
 * `blocked` if another tab is heartbeating, or `owned` once this tab has
 * acquired the lock.
 */
export type SessionLockState = "checking" | "blocked" | "owned" | "error";

/**
 * State machine for canvas refresh recovery. `loading` is shown briefly on
 * mount while the snapshot endpoint is queried; `restored` fires when a
 * non-empty prior canvas was rehydrated into local state; `none` means there
 * was nothing recoverable (fresh interview).
 */
export type RecoveryState = "loading" | "restored" | "none";

/**
 * Compile-time provider switch for the SSE stream backend (PR #237 Phase 1).
 *
 * - unset or `"netlify"` → `/api/v1/interviews/<id>/stream` (Netlify Function,
 *   capped at 300 s).
 * - `"gcp"` → `/api/v1/interviews/<id>/stream-gcp` (Firebase Hosting rewrites
 *   onto the `interviewStream` Cloud Function, up to 30 min per request).
 *
 * The default is intentionally `netlify` so a stale or missing build env
 * never routes production guests onto a not-yet-deployed Cloud Function.
 * Flip to `gcp` per-environment via Netlify build variables; reading
 * `process.env.NEXT_PUBLIC_*` at build time also makes this safe inside
 * the React tree (no runtime fetch, no hydration mismatch).
 *
 * Pure and exported so unit tests can assert URL shape without spinning up
 * the full hook (which pulls EventSource, RealtimeClient, etc.).
 */
export function buildInterviewStreamPath(interviewId: string): string {
  const provider = process.env.NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER;
  const suffix = provider === "gcp" ? "stream-gcp" : "stream";
  return `/api/v1/interviews/${interviewId}/${suffix}`;
}

export function useInterviewSession(input: UseInterviewSessionInput) {
  const clientRef = useRef<RealtimeClient | null>(null);
  // Holds the SSE-effect's `pushNarrationCue` so the hook can expose an
  // external `sendUserEditCue` that funnels through the same dedup window
  // and logging the tool cues use. Wired inside the mount effect once the
  // closure is built; null before mount and after unmount.
  const pushNarrationCueRef = useRef<
    ((kind: string, text: string) => boolean) | null
  >(null);
  const orbStateRef = useRef<OrbState>("idle");
  const realtimeStateRef = useRef<RealtimeClientState>("idle");
  const firstWriterEventLoggedRef = useRef(false);
  // True once the client has observed the AI's first turn (audio or transcript)
  // since mount. Cancels the boot-greeting timeout warning. Kept as a ref
  // because the timeout fires from a `setTimeout` closure that runs outside
  // React's render path — using state would risk a stale read.
  const firstAiTurnObservedRef = useRef(false);
  // Handle for the boot-greeting timeout so it can be cleared on unmount or
  // when the AI's first turn arrives. Stored in a ref for the same closure
  // reasons as `firstAiTurnObservedRef`.
  const greetingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Populated on mount inside useMountEffect — Date.now() is impure so it
  // cannot run during render under React 19's purity rule.
  const sessionStartRef = useRef<number>(0);
  const [orbState, setOrbStateRaw] = useState<OrbState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [canvas, setCanvas] = useState<CanvasState>({
    title: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  });
  const [reconnecting, setReconnecting] = useState(false);
  const [writerState, setWriterState] = useState<{
    isAppending: boolean;
    lastDiffAt: number;
    lastSectionId: string | null;
  }>({
    isAppending: false,
    lastDiffAt: 0,
    lastSectionId: null,
  });
  const [sessionLockState, setSessionLockState] = useState<SessionLockState>("checking");
  const [sessionLockHolder, setSessionLockHolder] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("loading");
  const [recentToolCalls, setRecentToolCalls] = useState<ToolCallActivity[]>([]);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  // Epoch ms of the most recent `end_interview` tool call observed on the
  // realtime data channel. Surfaced as part of the hook return so the
  // consumer can also reflect "end signalled" in the UI (e.g. flash a
  // confirmation banner). The primary trigger for the /end POST is the
  // `onEndRequested` callback below — this state value is informational.
  const [endRequestedAt, setEndRequestedAt] = useState<number | null>(null);
  // Latched ref to the consumer's `onEndRequested` callback. Updated
  // synchronously via useInsertionEffect so the data-channel callback
  // (which runs outside the render path) always sees the freshest
  // closure — no stale-state bugs even when the consumer's callback
  // captures volatile state like `callEnded` or `isEnding`.
  const onEndRequestedRef = useLatestRef(input.onEndRequested);
  const lockControllerRef = useRef<SessionLockController | null>(null);
  const heartbeatIdRef = useRef<string>("");
  const startSessionRef = useRef<(() => void) | null>(null);
  const eventBuffer = useRef<EventLog[]>([]);

  // Log every orb state transition with previous state + reason so ops can
  // reconstruct the user's UX timeline from logs alone.
  const setOrbState = useCallback((next: OrbState, reason: string) => {
    const prev = orbStateRef.current;
    if (prev === next) return;
    orbStateRef.current = next;
    log.info("Orb state transition", {
      from: prev,
      to: next,
      reason,
      interviewId: input.interviewId,
      timestamp: new Date().toISOString(),
    });
    setOrbStateRaw(next);
  }, [input.interviewId]);

  const flushEvents = useCallback(async () => {
    if (eventBuffer.current.length === 0) return;
    const batch = eventBuffer.current.splice(0, 100);
    try {
      const res = await fetch(`/api/v1/interviews/${input.interviewId}/events`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        log.error(`Failed to flush events batch: ${res.status}`);
        // Push back on failure for next flush
        eventBuffer.current.unshift(...batch);
      }
    } catch (err) {
      log.error("Failed to post events to backend", { error: err });
      eventBuffer.current.unshift(...batch);
    }
  }, [input.interviewId]);

  const sendMessage = useCallback(async (text: string): Promise<void> => {
    const trimmed = text?.trim() ?? "";
    if (!trimmed) return;
    // Dedicated POST so the caller can `await` success/failure. The
    // periodic event buffer batches transcripts opportunistically and
    // swallows errors, which is the right behaviour there but obscures
    // failures for explicit, user-initiated guide notes that the UI
    // wants to mark as "failed" so the author can retry.
    const event = {
      ts: new Date().toISOString(),
      kind: "chat_input" as const,
      payload: { text },
    };
    const res = await fetch(`/api/v1/interviews/${input.interviewId}/events`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([event]),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.error("Guide note send failed", {
        interviewId: input.interviewId,
        status: res.status,
        detail: detail.slice(0, 200),
      });
      throw new Error(`Failed to send guide note (${res.status})`);
    }
    // Append the user turn to the visible chat log only after the server
    // accepts it — failures stay surfaced via the InterviewChatInput chip so
    // the author can retry without an orphaned "User: …" row in the log.
    setChatTurns((prev) =>
      appendChatTurn(prev, {
        role: "user",
        text: trimmed,
        timestamp: Date.now(),
      }),
    );
  }, [input.interviewId]);

  useMountEffect(() => {
    sessionStartRef.current = Date.now();
    log.info("Mounting interview session hook", { interviewId: input.interviewId });

    let unmounted = false;
    let sessionStarted = false;

    // Initialize WebRTC client
    const client = new RealtimeClient({
      onTranscript: ({ role, text }) => {
        log.debug("Transcript received", { role, text });
        eventBuffer.current.push({
          ts: new Date().toISOString(),
          kind: role === "user" ? "transcript_user" : "transcript_ai",
          payload: { text },
        });
      },
      onToolCall: (call) => {
        log.debug("Tool call received", call);
        eventBuffer.current.push({
          ts: new Date().toISOString(),
          kind: "tool_call",
          payload: call,
        });
        // Surface the in-flight tool call into the live activity feed
        // immediately, without waiting for the SSE round-trip via Firestore.
        // The SSE path can be slow or briefly drop, but the realtime data
        // channel is the canonical source of "the AI just emitted a tool
        // call". Without this push the feed was empty during real sessions
        // because the SSE pipeline was the only writer to `recentToolCalls`.
        appendToolCall(toolCallEntryFromRealtime(call, Date.now()));
        // `end_interview` is the AI's "wrap this session up" signal. The
        // server-side handler is a pure ack (see tools/end-interview.ts);
        // the actual /end POST runs client-side via the same flow as the
        // End Session button. Surfacing a monotonic timestamp lets the
        // consuming component fire that flow without us having to import
        // navigation primitives into the hook.
        if (call.name === "end_interview") {
          log.info("end_interview tool received — signalling consumer", {
            interviewId: input.interviewId,
            callId: call.callId ?? null,
          });
          setEndRequestedAt(Date.now());
          // Force the realtime/WebRTC channel closed BEFORE handing off to
          // the consumer so the AI can't keep speaking after asking to
          // end. Mirrors the End Session button's `session.end()` call
          // ordering. Best-effort: a forceEnd failure (already closed,
          // mock client) should not block the /end POST.
          try {
            clientRef.current?.forceEnd();
          } catch (err: unknown) {
            log.warn("forceEnd during end_interview threw (non-blocking)", {
              interviewId: input.interviewId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          // Invoke the consumer's end callback. Wrapped in try/catch so a
          // throwing consumer never derails the rest of the realtime
          // dispatch loop (other tool calls in flight, transcript flush,
          // etc.). The consumer drives the actual /end POST + navigate.
          try {
            onEndRequestedRef.current?.();
          } catch (err: unknown) {
            log.error("onEndRequested callback threw", {
              interviewId: input.interviewId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      },
      onAudioLevel: setAudioLevel,
      onStateChange: (s) => {
        const prevRealtimeState = realtimeStateRef.current;
        realtimeStateRef.current = s;
        log.info("RealtimeClient state changed", {
          from: prevRealtimeState,
          to: s,
          interviewId: input.interviewId,
          timestamp: new Date().toISOString(),
        });
        if (s === "live") {
          setReconnecting(false);
          setOrbState("listening", `realtime:${prevRealtimeState}->live`);
          // Arm the AI-greeting timeout the first time we land `live`. If
          // the AI doesn't speak within AI_GREETING_TIMEOUT_MS the system
          // prompt's "Begin the conversation immediately" directive
          // probably regressed — surface a single structured WARN so the
          // failure is visible in gcloud. A subsequent reconnect that
          // re-enters `live` does not re-arm: the AI greets once per
          // session, and a later reconnect lands mid-conversation.
          if (!firstAiTurnObservedRef.current && greetingTimeoutRef.current === null) {
            greetingTimeoutRef.current = setTimeout(() => {
              greetingTimeoutRef.current = null;
              if (firstAiTurnObservedRef.current) return;
              clientLog.warn("ai_greeting_timeout", {
                interviewId: input.interviewId,
                waitedMs: AI_GREETING_TIMEOUT_MS,
              });
            }, AI_GREETING_TIMEOUT_MS);
          }
        } else if (s === "reconnecting") {
          setReconnecting(true);
          setOrbState("thinking", `realtime:${prevRealtimeState}->reconnecting`);
        } else if (s === "error") {
          setOrbState("error", `realtime:${prevRealtimeState}->error`);
        } else if (s === "ended") {
          setOrbState("idle", `realtime:${prevRealtimeState}->ended`);
        }
      },
      onConversationState: (cs) => {
        // `ai_speaking` is the earliest signal that the AI is actually
        // producing audio for the greeting — flip the observed flag so the
        // greeting-timeout warning is cancelled. Done outside the muted
        // short-circuit below because muting after connect must not mask
        // the greeting-arrival signal.
        if (cs === "ai_speaking" && !firstAiTurnObservedRef.current) {
          firstAiTurnObservedRef.current = true;
          if (greetingTimeoutRef.current !== null) {
            clearTimeout(greetingTimeoutRef.current);
            greetingTimeoutRef.current = null;
          }
        }
        // Turn-level transitions arrive while the connection stays `live`.
        // Map each onto an orb state so the visible orb tracks whose turn
        // it is on the wire (was: stuck on `listening` because only the
        // connection-level state was wired). Skip transitions when the
        // user has muted — `muted` should stay sticky until they unmute.
        if (orbStateRef.current === "muted") return;
        const reason: Record<RealtimeConversationState, string> = {
          user_speaking: "conversation:user_speaking",
          ai_thinking: "conversation:ai_thinking",
          ai_speaking: "conversation:ai_speaking",
          ai_done: "conversation:ai_done",
        };
        const next: OrbState =
          cs === "user_speaking"
            ? "listening"
            : cs === "ai_thinking"
              ? "thinking"
              : cs === "ai_speaking"
                ? "speaking"
                : "listening";
        setOrbState(next, reason[cs]);
      },
      onAiChatTurn: ({ text, timestamp }) => {
        // The realtime client deduplicates audio-delta noise and only fires
        // here on `response.audio_transcript.done`, so each call is the AI's
        // final text for a single completed turn. Append directly into the
        // visible log — Firestore persistence is already handled by the
        // existing `transcript_ai` event buffered above via `onTranscript`.
        setChatTurns((prev) =>
          appendChatTurn(prev, { role: "ai", text, timestamp }),
        );
      },
      onUsage: (usage) => {
        log.debug("Usage report received", usage);
        eventBuffer.current.push({
          ts: new Date().toISOString(),
          kind: "transcript_ai",
          payload: { usage },
        });
      },
    });

    clientRef.current = client;

    // Establish Server-Sent Events (SSE) Stream with a managed reconnect
    // policy. Browser-native EventSource auto-reconnect produces an unbounded
    // storm of `{isTrusted:true}` error events when the server churns; we own
    // the lifecycle here so we can log structured diagnostics and apply
    // exponential backoff with a hard retry cap.
    // The interview token is delivered via an HttpOnly cookie set by the
    // /consent route (F-006), so we no longer append `?token=` to the URL.
    // EventSource is same-origin here and sends cookies automatically.
    // Path picks the Netlify route by default, or the Cloud Function path
    // when `NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER=gcp` is set at build time
    // (PR #237 Phase 1 dark-launch — see `buildInterviewStreamPath`).
    const streamPath = buildInterviewStreamPath(input.interviewId);
    const streamUrl = streamPath;
    let activeEventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let activityIntervalId: ReturnType<typeof setInterval> | null = null;
    let toolCallEvictionId: ReturnType<typeof setInterval> | null = null;
    let sseRetryCount = 0;
    let sseLastEventId: string | null = null;
    let sseGivenUp = false;
    let sseUnmounted = false;

    const handleWriterDiff = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const diff = JSON.parse(msg.data);
        // First writer event tells ops the worker is alive — i.e. the
        // "Waiting for first section scaffolding..." spinner should now
        // disappear. If this log never fires, the writer never delivered.
        if (!firstWriterEventLoggedRef.current) {
          firstWriterEventLoggedRef.current = true;
          log.info("First writer_diff event received", {
            interviewId: input.interviewId,
            diffType: diff?.type,
            waitMs: Date.now() - sessionStartRef.current,
            timestamp: new Date().toISOString(),
          });
        }
        log.debug("Received writer_diff SSE message", diff);
        // Capture the post-apply canvas size from inside the functional
        // setState updater so the log reflects the actual mutated state
        // (not a stale closure read of `canvas`). Returning the same
        // reference that applyDiff produces keeps the render cost
        // identical to a bare applyDiff call.
        let postApplyCanvas: CanvasState | null = null;
        applyDiff((updater) => {
          setCanvas((current) => {
            const next =
              typeof updater === "function"
                ? (updater as (prev: CanvasState) => CanvasState)(current)
                : updater;
            postApplyCanvas = next;
            return next;
          });
        }, diff);
        log.info("applied_writer_diff", {
          interviewId: input.interviewId,
          diffType: diff?.type,
          canvasSections: postApplyCanvas
            ? (postApplyCanvas as CanvasState).sections.length
            : null,
        });
        // Track writer activity for cursor + typing-sound feedback. Only
        // content-producing diffs (title, section content, finalisation) count
        // as "appending" — section_added on its own creates an empty scaffold
        // and is surfaced via hasEmptyTrailingSection instead.
        if (isContentProducingDiff(diff)) {
          const now = Date.now();
          const sectionId = extractSectionId(diff);
          setWriterState((prev) => ({
            isAppending: true,
            lastDiffAt: now,
            lastSectionId: sectionId ?? prev.lastSectionId,
          }));
        }
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "writer_diff" });
      }
    };

    const handleCanvasEdit = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const data = JSON.parse(msg.data);
        log.debug("Received canvas_edit SSE message", data);
        applyDiff(setCanvas, { type: "human_edit_applied", payload: data });
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "canvas_edit" });
      }
    };

    const appendToolCall = (entry: ToolCallActivity) => {
      setRecentToolCalls((prev) => {
        const next = [entry, ...prev];
        if (next.length > TOOL_CALL_MAX_ENTRIES) {
          next.length = TOOL_CALL_MAX_ENTRIES;
        }
        return next;
      });
    };

    const handleToolCall = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const entry = parseToolCallSseEvent(msg.data, Date.now());
        if (entry) appendToolCall(entry);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "tool_call" });
      }
    };

    const handleToolFailed = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const entry = parseToolFailedSseEvent(msg.data, Date.now());
        if (entry) appendToolCall(entry);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "tool_failed" });
      }
    };

    // Records the most recent structured `event: error` payload the server
    // emitted before closing the stream. Drives the onerror policy: a
    // server-declared `retryable: false` short-circuits the backoff loop
    // and surfaces to the UI immediately, while a missing/retryable error
    // falls through to the existing backoff path.
    let lastServerError: SseServerErrorPayload | null = null;

    /**
     * Dedup window for narration cues. When an SSE reconnect lands, the
     * server replays every event that fired since `lastEventId`, which on a
     * busy session can flood the realtime data channel with N copies of the
     * same `tool_result`/`tool_in_flight`/`tool_completed` cue in a few
     * milliseconds. Each cue costs an extra round-trip on the AI's data
     * channel and can cause the model to narrate the same tool result
     * multiple times in a row. We drop a cue whose `(kind, text)` pair was
     * already pushed within NARRATION_CUE_DEDUP_WINDOW_MS — both because
     * the realtime model has already received it on the first push, and
     * because the latency the cue exists to mask is bounded by the
     * original tool call, not by the SSE replay.
     */
    const recentCues = new Map<string, number>();
    /**
     * Push a narration cue into the live WebRTC data channel. The cue is a
     * short system-role message that tells the realtime model what just
     * happened ("title applied"); the model responds by speaking a one-line
     * narration ("Got it — title's set."). Without these cues the model
     * dispatches a tool and falls silent for the full call latency, which
     * on a voice channel feels like a hang.
     *
     * Logged at info so the next QA can see the AI's narration cadence in
     * the browser console alongside the SSE events that triggered each cue.
     *
     * Returns `true` when the cue was forwarded, `false` when it was
     * dropped by the dedup window — exposed so the test harness can drive
     * the dedup behaviour deterministically without spying on the realtime
     * client.
     */
    const pushNarrationCue = (kind: string, text: string): boolean => {
      const client = clientRef.current;
      if (!client) {
        log.debug("Narration cue dropped — realtime client not yet ready", {
          kind,
          textLength: text.length,
        });
        return false;
      }
      // Dedup by full cue text — `kind` alone collides (every tool_result
      // shares a kind) and the rendered cue includes the tool name + the
      // result summary so identical strings are very strong evidence of a
      // replay rather than two genuinely separate tool dispatches.
      const dedupKey = `${kind}:${text}`;
      const now = Date.now();
      if (!shouldForwardNarrationCue(recentCues, dedupKey, now)) {
        log.debug("Narration cue dropped — duplicate within dedup window", {
          kind,
          textLength: text.length,
        });
        return false;
      }
      log.info("Pushing narration cue to realtime session", {
        kind,
        textLength: text.length,
        interviewId: input.interviewId,
      });
      client.sendNarrationCue(text, { kind });
      return true;
    };
    // Expose the closure so the external `sendUserEditCue` returned by the
    // hook funnels user-edit cues through the same dedup + logging path.
    pushNarrationCueRef.current = pushNarrationCue;

    const handleToolResult = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const data = JSON.parse(msg.data) as {
          toolName?: string;
          ok?: boolean;
          summary?: string;
          errorKind?: string;
          message?: string;
        };
        const toolName = data.toolName ?? "tool";
        const friendly = labelForTool(toolName);
        const cue = data.ok
          ? `[system narration cue] Canvas update — "${friendly}" just landed (${data.summary ?? "ok"}). In one short sentence, acknowledge the change as a human interviewer would (no tool names, no jargon) and ask the next question.`
          : `[system narration cue] Canvas update — "${friendly}" didn't take (${data.errorKind ?? "error"}: ${data.message ?? ""}). In one short sentence, acknowledge it casually (no tool names) and steer the conversation forward.`;
        pushNarrationCue("tool_result", cue);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "tool_result" });
      }
    };

    const handleToolInFlight = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const data = JSON.parse(msg.data) as { toolName?: string };
        const toolName = data.toolName ?? "tool";
        const friendly = labelForTool(toolName);
        const cue = `[system narration cue] Canvas update — "${friendly}" is running in the background and will take a few seconds. In one short sentence, keep the conversation alive as a human interviewer would (no tool names, no jargon) — don't go silent.`;
        pushNarrationCue("tool_in_flight", cue);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "tool_in_flight" });
      }
    };

    const handleToolCompleted = (ev: Event) => {
      const msg = ev as MessageEvent;
      sseLastEventId = msg.lastEventId || sseLastEventId;
      try {
        const data = JSON.parse(msg.data) as {
          toolName?: string;
          ok?: boolean;
          summary?: string;
          message?: string;
        };
        const toolName = data.toolName ?? "tool";
        const friendly = labelForTool(toolName);
        const cue = data.ok
          ? `[system narration cue] Canvas update — "${friendly}" just finished in the background (${data.summary ?? "ok"}). In one short sentence, mention it naturally (no tool names) and ask the next question.`
          : `[system narration cue] Canvas update — "${friendly}" didn't take (${data.message ?? "error"}). In one short sentence, acknowledge casually (no tool names) and offer an alternative.`;
        pushNarrationCue("tool_completed", cue);
      } catch (err) {
        log.error("Failed to parse SSE event data", { error: err, event: "tool_completed" });
      }
    };

    const handleHello = () => {
      // Server sent its initial frame — the stream is fully established. Reset
      // retry bookkeeping so a later failure starts at the shortest delay.
      if (sseRetryCount > 0) {
        log.info("SSE stream reconnected", { urlPath: streamPath, attempts: sseRetryCount });
      }
      sseRetryCount = 0;
      lastServerError = null;
      setReconnecting(false);
    };

    const handleServerError = (ev: Event) => {
      const msg = ev as MessageEvent;
      try {
        const data = JSON.parse(msg.data) as SseServerErrorPayload;
        if (data && typeof data.reason === "string") {
          lastServerError = data;
          // Log at INFO when retryable so ops can correlate a "first-attempt
          // 401 → success on retry" cookie race; WARN otherwise because a
          // non-retryable server error means the user will see a stuck UI
          // unless something acts on it.
          if (data.retryable === false) {
            log.warn("SSE server emitted non-retryable error", {
              urlPath: streamPath,
              reason: data.reason,
              code: data.code,
            });
          } else {
            log.info("SSE server emitted retryable error", {
              urlPath: streamPath,
              reason: data.reason,
              code: data.code,
            });
          }
        }
      } catch {
        // Server sent a malformed error frame; fall through to the generic
        // onerror handler which will still apply backoff.
      }
    };

    const openSseConnection = () => {
      if (sseUnmounted || sseGivenUp) return;
      const evs = new EventSource(streamUrl);
      activeEventSource = evs;

      evs.addEventListener("hello", handleHello);
      evs.addEventListener("writer_diff", handleWriterDiff);
      evs.addEventListener("canvas_edit", handleCanvasEdit);
      evs.addEventListener("tool_call", handleToolCall);
      evs.addEventListener("tool_failed", handleToolFailed);
      // Server-emitted structured error frame. Parses + records the payload
      // BEFORE onerror runs so the reconnection policy can consult
      // `lastServerError.retryable` and short-circuit when appropriate.
      evs.addEventListener("error", handleServerError);
      // Narration cue events — surface every tool lifecycle transition
      // to the realtime model so it speaks instead of going silent.
      evs.addEventListener("tool_result", handleToolResult);
      evs.addEventListener("tool_in_flight", handleToolInFlight);
      evs.addEventListener("tool_completed", handleToolCompleted);

      evs.onerror = () => {
        // EventSource fires `error` with no diagnostic payload. The most
        // useful signals are readyState (did the browser already close it?)
        // and how many consecutive attempts have failed.
        const readyState = evs.readyState;
        const readyStateName = SSE_READY_STATE[readyState] ?? `unknown(${readyState})`;

        // Tear down this EventSource so we don't double up with the browser's
        // own retry — we own reconnection from here.
        try {
          evs.close();
        } catch {
          // ignore
        }
        if (activeEventSource === evs) {
          activeEventSource = null;
        }

        // Honour a server-declared non-retryable error: skip the backoff
        // loop entirely and surface to the UI immediately. Without this the
        // client would burn through all 8 retries trying to recover a
        // tampered/cross-interview token that can never succeed.
        if (lastServerError && lastServerError.retryable === false) {
          sseGivenUp = true;
          log.error("SSE stream — server declared non-retryable error", {
            urlPath: streamPath,
            reason: lastServerError.reason,
            code: lastServerError.code,
            readyState: readyStateName,
          });
          setReconnecting(false);
          setOrbState("error", `sse_server_error:${lastServerError.reason}`);
          return;
        }

        sseRetryCount += 1;
        setReconnecting(true);

        if (sseRetryCount > SSE_MAX_RETRIES) {
          sseGivenUp = true;
          log.error("SSE stream lost — giving up after max retries", {
            urlPath: streamPath,
            retryCount: sseRetryCount,
            maxRetries: SSE_MAX_RETRIES,
            lastEventId: sseLastEventId,
            readyState: readyStateName,
          });
          setReconnecting(false);
          setOrbState("error", "sse_max_retries_exceeded");
          return;
        }

        const delay = sseBackoffDelay(sseRetryCount - 1);
        // First-connect grace: the first SSE_FIRST_CONNECT_GRACE_RETRIES
        // failures inside SSE_FIRST_CONNECT_GRACE_MS of mount are most
        // likely a benign cookie-attach race (see SSE_FIRST_CONNECT_GRACE_*
        // and `buildInterviewTokenCookie`). Log at DEBUG inside the window
        // so a healthy reconnect-after-blip doesn't trip ops dashboards;
        // escalate to WARN once we're past the window OR the retry count
        // exceeds the grace threshold, since at that point the cookie race
        // hypothesis is no longer the most likely explanation.
        const elapsedSinceMount = Date.now() - sessionStartRef.current;
        const insideFirstConnectGrace =
          sseRetryCount <= SSE_FIRST_CONNECT_GRACE_RETRIES &&
          elapsedSinceMount <= SSE_FIRST_CONNECT_GRACE_MS;
        const logFields = {
          urlPath: streamPath,
          retryCount: sseRetryCount,
          maxRetries: SSE_MAX_RETRIES,
          backoffMs: delay,
          lastEventId: sseLastEventId,
          readyState: readyStateName,
          elapsedSinceMountMs: elapsedSinceMount,
          ...(lastServerError
            ? {
                serverReason: lastServerError.reason,
                serverCode: lastServerError.code,
              }
            : {}),
        };
        if (insideFirstConnectGrace) {
          log.debug(
            "SSE stream lost — backing off (within first-connect grace)",
            logFields,
          );
        } else {
          // Log a single structured warning per backoff cycle. The previous
          // implementation logged `{isTrusted:true}` on every native retry,
          // which produced the SSE error spam in production.
          log.warn("SSE stream lost — backing off", logFields);
        }

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          openSseConnection();
        }, delay);
      };
    };

    // Gate realtime + SSE startup behind the single-active-session lock so a
    // second tab opening the same interview cannot silently steal the audio
    // stream. The caller surfaces a takeover UI when sessionLockState is
    // "blocked"; calling `requestTakeover()` invokes startSession again with
    // a forced takeover beat.
    const startSession = () => {
      if (unmounted) return;
      if (sessionStarted) return;
      sessionStarted = true;

      // Connect to WebRTC. `interviewId` is forwarded so the realtime
      // client's `first_ai_turn` boot log carries the interview id —
      // without it the gcloud query has no way to correlate "did the AI
      // greet?" with the specific session.
      client.connect({
        ephemeralToken: input.ephemeralOpenAiToken,
        audioInputDeviceId: input.audioInputDeviceId,
        interviewId: input.interviewId,
      }).catch((err) => {
        log.error("Initial connect failed", { error: err, interviewId: input.interviewId });
        setOrbState("error", "initial_connect_failed");
      });

      openSseConnection();

      // Periodically flush events
      intervalId = setInterval(() => {
        void flushEvents();
      }, 1000);

      // Periodically re-evaluate writer activity so isAppending flips back to
      // false ~1.5s after the last content-producing diff (drives cursor blink
      // off and stops the typing sound).
      activityIntervalId = setInterval(() => {
        setWriterState((prev) => {
          if (!prev.isAppending) return prev;
          if (Date.now() - prev.lastDiffAt > WRITER_ACTIVE_TIMEOUT_MS) {
            return { ...prev, isAppending: false };
          }
          return prev;
        });
      }, 500);

      // Evict tool-call activity rows older than TOOL_CALL_TTL_MS so the live
      // feed never grows unbounded over a 30-minute interview.
      toolCallEvictionId = setInterval(() => {
        setRecentToolCalls((prev) => {
          if (prev.length === 0) return prev;
          const cutoff = Date.now() - TOOL_CALL_TTL_MS;
          const filtered = prev.filter((entry) => entry.observedAt > cutoff);
          return filtered.length === prev.length ? prev : filtered;
        });
      }, 1_000);
    };
    startSessionRef.current = startSession;

    // Kick off pre-flight: canvas snapshot recovery + session-lock check.
    // Both run in parallel against the server. Once the lock check settles,
    // if the lock is ours we start the realtime session. If another tab
    // owns it, we leave the orb in "checking" and wait for the user to take
    // over via `requestTakeover()`.
    const heartbeatId = generateHeartbeatId();
    heartbeatIdRef.current = heartbeatId;

    // Canvas recovery — restore in-progress draft on refresh. Independent of
    // the lock check so we can rehydrate the canvas even while the takeover
    // dialog is pending.
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/interviews/${input.interviewId}/canvas-snapshot`,
          {
            method: "GET",
            credentials: "same-origin",
          },
        );
        if (unmounted) return;
        if (!res.ok) {
          setRecoveryState("none");
          return;
        }
        const body = (await res.json()) as {
          canvas: CanvasState | null;
          snapshotAt: number | null;
        };
        if (body.canvas && body.canvas.sections && body.canvas.sections.length > 0) {
          log.info("Restored canvas from snapshot", {
            interviewId: input.interviewId,
            sectionCount: body.canvas.sections.length,
            snapshotAt: body.snapshotAt,
          });
          setCanvas(body.canvas);
          setRecoveryState("restored");
          setTimeout(() => {
            if (!unmounted) setRecoveryState("none");
          }, 3_000);
        } else {
          setRecoveryState("none");
        }
      } catch (err) {
        log.warn("Canvas recovery fetch failed (continuing without restore)", {
          interviewId: input.interviewId,
          error: err instanceof Error ? err.message : String(err),
        });
        setRecoveryState("none");
      }
    })();

    // Session-lock check. If no other tab is holding a fresh lock, acquire
    // immediately and start the session. Otherwise expose the conflicting
    // holder so the UI can prompt the user to take over.
    void (async () => {
      try {
        const status = await fetchSessionLockStatus({
          interviewId: input.interviewId,
        });
        if (unmounted) return;
        if (status.holder && !status.stale) {
          log.info("Session lock contested — pausing startup", {
            interviewId: input.interviewId,
            holder: status.holder,
          });
          setSessionLockHolder(status.holder);
          setSessionLockState("blocked");
          return;
        }
        // No active holder (or holder is stale) — claim the lock and run.
        const controller = startSessionLockHeartbeat({
          interviewId: input.interviewId,
          heartbeatId,
          onConflict: ({ currentHolder }) => {
            setSessionLockHolder(currentHolder);
            setSessionLockState("blocked");
            setOrbState("idle", "session_lock_revoked");
            client.forceEnd();
          },
        });
        lockControllerRef.current = controller;
        setSessionLockState("owned");
        startSession();
      } catch (err) {
        log.error("Session lock check failed", {
          interviewId: input.interviewId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fail-open so a session-lock outage doesn't strand the user. The
        // call proceeds without a heartbeat — the worst case is a second
        // tab also running unguarded, which is no worse than today's
        // behaviour pre-feature.
        if (!unmounted) {
          setSessionLockState("owned");
          startSession();
        }
      }
    })();

    // Unmount cleanup
    return () => {
      log.info("Cleaning up interview session");
      unmounted = true;
      sseUnmounted = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeEventSource) {
        try {
          activeEventSource.close();
        } catch {
          // ignore
        }
        activeEventSource = null;
      }
      if (activityIntervalId !== null) clearInterval(activityIntervalId);
      if (toolCallEvictionId !== null) clearInterval(toolCallEvictionId);
      if (greetingTimeoutRef.current !== null) {
        clearTimeout(greetingTimeoutRef.current);
        greetingTimeoutRef.current = null;
      }
      void lockControllerRef.current?.stop();
      lockControllerRef.current = null;
      pushNarrationCueRef.current = null;
      client.disconnect();
      void flushEvents();
    };
  });

  const lastSection = canvas.sections[canvas.sections.length - 1];
  const hasEmptyTrailingSection = Boolean(
    lastSection &&
      !lastSection.finalized &&
      !lastSection.heading &&
      lastSection.bullets.length === 0 &&
      lastSection.paragraphs.length === 0 &&
      lastSection.quotes.length === 0,
  );

  const writerActivity: WriterActivity = {
    isAppending: writerState.isAppending,
    lastWriteSectionId: writerState.lastSectionId,
    hasEmptyTrailingSection,
  };

  const requestTakeover = useCallback(async () => {
    if (sessionLockState !== "blocked") return;
    // Spin up a heartbeat with `takeover: true` so the server replaces the
    // current holder atomically. On success the lock is ours, we transition
    // to "owned" and let startSession kick off the realtime + SSE pipes.
    const heartbeatId = heartbeatIdRef.current || generateHeartbeatId();
    heartbeatIdRef.current = heartbeatId;
    const controller = startSessionLockHeartbeat({
      interviewId: input.interviewId,
      heartbeatId,
      skipInitialBeat: true,
      onConflict: ({ currentHolder }) => {
        setSessionLockHolder(currentHolder);
        setSessionLockState("blocked");
        setOrbState("idle", "session_lock_revoked");
        clientRef.current?.forceEnd();
      },
    });
    lockControllerRef.current = controller;
    await controller.takeover();
    setSessionLockHolder(null);
    setSessionLockState("owned");
    startSessionRef.current?.();
  }, [input.interviewId, sessionLockState, setOrbState]);

  // Stable callback the in-call canvas uses to tell the AI about a human
  // edit. Routes through the same dedup window + structured logging the
  // tool-driven narration cues use so a fast typist can't flood the
  // realtime data channel with redundant cues. The cue text itself is
  // built upstream by `summarizeUserEditFromDoc` so this layer stays a
  // pure pipe. The return value is forwarded to the canvas editor so it
  // can render the inline "AI saw this" widget chip at the user's most-
  // recent edit position when the cue successfully leaves the local
  // client.
  const sendUserEditCue = useCallback((text: string): boolean => {
    const push = pushNarrationCueRef.current;
    if (!push) return false;
    return push("user_edit", text);
  }, []);

  // Stable callback the duration-timer uses to nudge the AI as the call's
  // hard cap approaches. Cues are tagged kind=`time_remaining` so they
  // are distinguishable from tool-driven and user-edit cues in the
  // structured logs and dedup map. Same pipe (and same dedup window) as
  // every other cue — at 60s and 15s thresholds the timer fires this
  // once each, so the dedup map only collides on accidental double-fires.
  const sendTimeRemainingCue = useCallback((text: string): boolean => {
    const push = pushNarrationCueRef.current;
    if (!push) return false;
    return push("time_remaining", text);
  }, []);

  return {
    canvas,
    orbState,
    audioLevel,
    reconnecting,
    writerActivity,
    sendMessage,
    sendUserEditCue,
    sendTimeRemainingCue,
    sessionLockState,
    sessionLockHolder,
    recoveryState,
    recentToolCalls,
    chatTurns,
    endRequestedAt,
    requestTakeover,
    mute: (m: boolean) => {
      if (clientRef.current) {
        clientRef.current.mute(m);
        setOrbState(m ? "muted" : "listening", m ? "user_muted" : "user_unmuted");
      }
    },
    end: () => clientRef.current?.forceEnd(),
  };
}

function isContentProducingDiff(diff: SSEDiff | null | undefined): boolean {
  if (!diff?.type) return false;
  if (
    diff.type === "title_updated" ||
    diff.type === "section_updated" ||
    diff.type === "section_finalized" ||
    diff.type === "section_block_added" ||
    diff.type === "human_edit_applied"
  ) {
    return true;
  }
  // section_added counts as appending only if the payload includes real
  // content; an empty scaffold is surfaced via hasEmptyTrailingSection.
  if (diff.type === "section_added" && diff.payload) {
    const p = diff.payload as { heading?: unknown; bullets?: unknown[]; paragraphs?: unknown[]; quotes?: unknown[] };
    return (
      Boolean(p.heading) ||
      (Array.isArray(p.bullets) && p.bullets.length > 0) ||
      (Array.isArray(p.paragraphs) && p.paragraphs.length > 0) ||
      (Array.isArray(p.quotes) && p.quotes.length > 0)
    );
  }
  return false;
}

/**
 * Build a `ToolCallActivity` row from a parsed SSE `tool_call` payload. Pure
 * and exported so the reducer can be unit-tested without booting the React
 * SSR machinery. Returns null when the payload lacks a `name`, which is the
 * one structural invariant the feed depends on.
 */
export function parseToolCallSseEvent(
  raw: string,
  observedAt: number,
): ToolCallActivity | null {
  const data = JSON.parse(raw) as {
    name?: string;
    callId?: string;
    call_id?: string;
    arguments?: unknown;
  };
  if (!data?.name) return null;
  const callId = data.callId ?? data.call_id ?? "";
  return {
    key: `${callId || data.name}-${observedAt}`,
    name: data.name,
    label: summarizeToolArgs(data.name, data.arguments),
    status: "applied",
    observedAt,
  };
}

/**
 * Build a `ToolCallActivity` row from a parsed SSE `tool_failed` payload.
 * Pure and exported — see `parseToolCallSseEvent`. Returns null when the
 * payload lacks a `toolName`.
 */
export function parseToolFailedSseEvent(
  raw: string,
  observedAt: number,
): ToolCallActivity | null {
  const data = JSON.parse(raw) as {
    toolName?: string;
    callId?: string | null;
    message?: string;
    errorKind?: string;
  };
  if (!data?.toolName) return null;
  const callId = data.callId ?? "";
  return {
    key: `${callId || data.toolName}-${observedAt}-failed`,
    name: data.toolName,
    label: "",
    status: "failed",
    errorMessage: data.message || data.errorKind,
    observedAt,
  };
}

/**
 * Build a `ToolCallActivity` row from a realtime data-channel tool-call
 * callback payload. Pure and exported. The `-rtc` suffix on the key
 * distinguishes realtime-sourced rows from SSE-sourced rows so a tool call
 * observed on both paths cannot collide as the same React key.
 */
export function toolCallEntryFromRealtime(
  call: { name: string; arguments: unknown; callId?: string },
  observedAt: number,
): ToolCallActivity {
  return {
    key: `${call.callId || call.name}-${observedAt}-rtc`,
    name: call.name,
    label: summarizeToolArgs(call.name, call.arguments),
    status: "applied",
    observedAt,
  };
}

function summarizeToolArgs(toolName: string, args: unknown): string {
  if (args === null || args === undefined) return "";
  let obj: Record<string, unknown>;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
      obj = parsed as Record<string, unknown>;
    } catch {
      return "";
    }
  } else if (typeof args === "object" && !Array.isArray(args)) {
    obj = args as Record<string, unknown>;
  } else {
    return "";
  }
  // Preferred summary fields in priority order — the first string that's
  // present and non-empty wins. Truncated so a long quote doesn't blow out
  // the feed row.
  const candidates = ["heading", "title", "text", "sectionId", "field", "value", "tag", "url"] as const;
  for (const key of candidates) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) {
      const trimmed = v.trim();
      return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
    }
  }
  // Fallback: surface the count of items for tools that take arrays
  // (e.g. `set_tags`, `insert_bullets`) so the row carries any signal at all.
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) {
      return `${v.length} ${key}`;
    }
  }
  // Avoid unused-var warning for `toolName` — kept in the signature for
  // future per-tool customisation (e.g. richer summary for `replace_text`).
  void toolName;
  return "";
}

function extractSectionId(diff: SSEDiff | null | undefined): string | null {
  if (!diff?.payload) return null;
  const payload = diff.payload as {
    id?: unknown;
    sectionId?: unknown;
    intoSectionId?: unknown;
    fromSectionId?: unknown;
  };
  if (typeof payload.sectionId === "string") return payload.sectionId;
  if (typeof payload.id === "string") return payload.id;
  if (typeof payload.intoSectionId === "string") return payload.intoSectionId;
  if (typeof payload.fromSectionId === "string") return payload.fromSectionId;
  return null;
}

interface SSEDiff {
  type: string;
  payload?: Record<string, unknown>;
}

export function applyDiff(setCanvas: React.Dispatch<React.SetStateAction<CanvasState>>, diff: SSEDiff): void {
  setCanvas((prev) => {
    const next: CanvasState = JSON.parse(JSON.stringify(prev));
    if (!diff) return prev;

    switch (diff.type) {
      case "title_updated": {
        const payload = diff.payload as { title?: string } | undefined;
        if (payload?.title) {
          // Idempotent: skip the mutation when the title is already set to
          // the same value so an SSE replay storm (reconnect → server
          // re-fans every prior event) doesn't trigger unnecessary
          // re-renders or downstream effects keyed off canvas changes.
          if (prev.title === payload.title) return prev;
          next.title = payload.title;
        }
        break;
      }
      case "section_added":
        if (diff.payload) {
          const payload = diff.payload as unknown as CanvasSection;
          // Idempotent: every SSE reconnect causes the server to replay all
          // prior events. Without this guard the same `section_added` would
          // append the same section N times (once per reconnect), surfacing
          // as the "Definition and Origin" heading appearing three times in
          // production. Dedup by sectionId — the server-authoritative id is
          // stable across replays.
          if (payload?.id && next.sections.some((s) => s.id === payload.id)) {
            return prev;
          }
          next.sections.push(payload);
        }
        break;
      case "section_updated": {
        const payload = diff.payload as unknown as CanvasSection;
        if (payload?.id) {
          const tgt = next.sections.find((s) => s.id === payload.id);
          if (tgt) {
            Object.assign(tgt, payload);
          }
        }
        break;
      }
      case "section_removed": {
        const payload = diff.payload as { sectionId?: string } | undefined;
        if (payload?.sectionId) {
          next.sections = next.sections.filter((s) => s.id !== payload.sectionId);
        }
        break;
      }
      case "sections_reordered": {
        // Reorder in-place to match the server-authoritative order list.
        // Sections missing from the new order are dropped; unknown ids are
        // ignored. The payload comes from `move_section` after the worker
        // has already validated the section exists, so the dropped/unknown
        // paths are defensive only.
        const payload = diff.payload as { sectionIds?: string[] } | undefined;
        if (Array.isArray(payload?.sectionIds)) {
          const byId = new Map(next.sections.map((s) => [s.id, s] as const));
          next.sections = payload.sectionIds
            .map((id) => byId.get(id))
            .filter((s): s is CanvasSection => Boolean(s));
        }
        break;
      }
      case "section_merged": {
        // Worker also emits a follow-up `section_updated` carrying the merged
        // section's new content, so this diff only needs to drop the source
        // section so the client matches the server's section count.
        const payload = diff.payload as
          | { fromSectionId?: string; intoSectionId?: string }
          | undefined;
        if (payload?.fromSectionId) {
          next.sections = next.sections.filter(
            (s) => s.id !== payload.fromSectionId,
          );
        }
        break;
      }
      case "human_edit_applied": {
        const payload = diff.payload as {
          sectionId: string;
          field: "heading" | "paragraph_text" | "bullet_text";
          index?: number;
          value: string;
        } | undefined;
        if (payload?.sectionId) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            if (payload.field === "heading") {
              tgt.heading = payload.value;
            } else if (payload.field === "paragraph_text" && payload.index !== undefined && payload.index >= 0 && payload.index < tgt.paragraphs.length) {
              tgt.paragraphs[payload.index] = payload.value;
            } else if (payload.field === "bullet_text" && payload.index !== undefined && payload.index >= 0 && payload.index < tgt.bullets.length) {
              tgt.bullets[payload.index] = payload.value;
            }
          }
        }
        break;
      }
      case "section_finalized": {
        const payload = diff.payload as unknown as { sectionId: string };
        if (payload?.sectionId) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            tgt.finalized = true;
          }
        }
        break;
      }
      case "section_block_added": {
        const payload = diff.payload as
          | { sectionId?: string; block?: CanvasBlock }
          | undefined;
        if (payload?.sectionId && payload.block) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            if (!tgt.blocks) tgt.blocks = [];
            tgt.blocks.push(payload.block);
          }
        }
        break;
      }
      case "subtitle_updated": {
        const payload = diff.payload as { subtitle?: string | null } | undefined;
        if (payload && "subtitle" in payload) {
          const nextSubtitle = payload.subtitle ?? null;
          // Idempotent: skip the mutation when the subtitle already
          // matches so a replay storm doesn't trigger a no-op re-render.
          if ((prev.subtitle ?? null) === nextSubtitle) return prev;
          next.subtitle = nextSubtitle;
        }
        break;
      }
      case "slug_updated": {
        const payload = diff.payload as { slug?: string | null } | undefined;
        if (payload && "slug" in payload) {
          const nextSlug = payload.slug ?? null;
          // Idempotent: see `subtitle_updated`.
          if ((prev.slug ?? null) === nextSlug) return prev;
          next.slug = nextSlug;
        }
        break;
      }
      case "seo_meta_updated": {
        const payload = diff.payload as
          | { metaTitle?: string | null; metaDescription?: string | null }
          | undefined;
        if (payload) {
          if ("metaTitle" in payload) next.metaTitle = payload.metaTitle ?? null;
          if ("metaDescription" in payload) {
            next.metaDescription = payload.metaDescription ?? null;
          }
        }
        break;
      }
      case "list_added": {
        const payload = diff.payload as
          | { sectionId?: string; list?: CanvasList }
          | undefined;
        if (payload?.sectionId && payload.list) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            if (!tgt.lists) tgt.lists = [];
            tgt.lists.push(payload.list);
          }
        }
        break;
      }
      case "list_updated": {
        // `list` is optional in the worker's diff shape (e.g. when a list
        // is removed entirely). When present, replace the matching list
        // by id; when absent, drop the matching list. Without this case
        // a nested-bullet edit would leave the client's list stale.
        const payload = diff.payload as
          | { sectionId?: string; listId?: string; list?: CanvasList }
          | undefined;
        if (payload?.sectionId && payload.listId) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt && Array.isArray(tgt.lists)) {
            if (payload.list) {
              const idx = tgt.lists.findIndex((l) => l.id === payload.listId);
              if (idx !== -1) {
                tgt.lists[idx] = payload.list;
              } else {
                tgt.lists.push(payload.list);
              }
            } else {
              tgt.lists = tgt.lists.filter((l) => l.id !== payload.listId);
            }
          }
        }
        break;
      }
      case "featured_image_updated": {
        // Fire-and-forget `request_featured_image` / `regenerate_featured_image`
        // tools push the generated hero image to the canvas via this diff.
        // Without this case the diff is silently dropped and the Image tab
        // stays stuck on "Waiting for article title to generate image
        // concept..." even after the background pipeline completes.
        const payload = diff.payload as
          | { image?: CanvasImage | null }
          | undefined;
        if (payload && "image" in payload) {
          const nextImage = payload.image ?? null;
          // Idempotent: skip when the image (by id) is already set to the
          // same value so an SSE replay storm doesn't re-render the image
          // tab repeatedly.
          const prevImage = prev.featuredImage ?? null;
          if (prevImage?.id && nextImage?.id && prevImage.id === nextImage.id) {
            return prev;
          }
          if (prevImage === null && nextImage === null) return prev;
          next.featuredImage = nextImage;
        }
        break;
      }
      case "inline_image_added": {
        const payload = diff.payload as
          | { sectionId?: string; image?: CanvasImage }
          | undefined;
        if (payload?.sectionId && payload.image) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            if (!tgt.inlineImages) tgt.inlineImages = [];
            tgt.inlineImages.push(payload.image);
          }
        }
        break;
      }
      case "image_alt_updated": {
        // Walk featured + every section's inline images and patch the
        // alt text on whichever entry matches the id. Avoids forcing the
        // server to send an `(image, scope)` discriminator just for this
        // one mutation.
        const payload = diff.payload as
          | { imageId?: string; alt?: string }
          | undefined;
        if (payload?.imageId && typeof payload.alt === "string") {
          if (next.featuredImage && next.featuredImage.id === payload.imageId) {
            next.featuredImage = { ...next.featuredImage, alt: payload.alt };
          }
          for (const section of next.sections) {
            if (!section.inlineImages) continue;
            const idx = section.inlineImages.findIndex(
              (img) => img.id === payload.imageId,
            );
            if (idx !== -1) {
              section.inlineImages[idx] = {
                ...section.inlineImages[idx],
                alt: payload.alt,
              };
            }
          }
        }
        break;
      }
      case "seo_score_updated": {
        const payload = diff.payload as { score?: CanvasSeoScore } | undefined;
        if (payload?.score) {
          next.seoScore = payload.score;
        }
        break;
      }
      case "internal_link_suggestions_updated": {
        const payload = diff.payload as
          | { suggestions?: CanvasInternalLinkSuggestion[] }
          | undefined;
        if (Array.isArray(payload?.suggestions)) {
          next.internalLinkSuggestions = payload.suggestions;
        }
        break;
      }
      case "internal_link_added": {
        const payload = diff.payload as
          | {
              sectionId?: string;
              paragraphId?: string;
              range?: { start: number; end: number };
              targetSlug?: string;
            }
          | undefined;
        if (
          payload?.sectionId &&
          payload.paragraphId &&
          payload.range &&
          payload.targetSlug
        ) {
          const tgt = next.sections.find((s) => s.id === payload.sectionId);
          if (tgt) {
            if (!tgt.internalLinks) tgt.internalLinks = [];
            tgt.internalLinks.push({
              paragraphId: payload.paragraphId,
              range: payload.range,
              targetSlug: payload.targetSlug,
            });
          }
        }
        break;
      }
      case "keywords_updated": {
        const payload = diff.payload as { keywords?: string[] } | undefined;
        if (Array.isArray(payload?.keywords)) {
          next.keywords = payload.keywords;
        }
        break;
      }
      case "categories_updated": {
        const payload = diff.payload as { categories?: string[] } | undefined;
        if (Array.isArray(payload?.categories)) {
          next.categories = payload.categories;
        }
        break;
      }
      case "tags_updated": {
        const payload = diff.payload as { tags?: string[] } | undefined;
        if (Array.isArray(payload?.tags)) {
          next.tags = payload.tags;
        }
        break;
      }
      case "meta_updated": {
        const payload = diff.payload as Record<string, unknown> | undefined;
        if (payload) {
          if (payload.meta && typeof payload.meta === "object") {
            const metaPayload = payload.meta as Record<string, unknown>;
            next.meta = {
              description: typeof metaPayload.description === "string" ? metaPayload.description : next.meta.description,
              tags: Array.isArray(metaPayload.tags) ? (metaPayload.tags as string[]) : next.meta.tags,
              suggestedCategory: typeof metaPayload.suggestedCategory === "string" ? metaPayload.suggestedCategory : next.meta.suggestedCategory,
            };
          } else {
            next.meta = {
              description: typeof payload.description === "string" ? payload.description : next.meta.description,
              tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : next.meta.tags,
              suggestedCategory: typeof payload.suggestedCategory === "string" ? payload.suggestedCategory : next.meta.suggestedCategory,
            };
          }
        }
        break;
      }
      case "upsert_paragraph": {
        // Add or replace a paragraph by id inside a section. Emitted by the
        // writer-worker's LLM refinement pass when it wants to express
        // "this paragraph (by id) should now have this text" without
        // rebuilding the entire `section.paragraphs[]`. The previous
        // omission of this case caused every refinement paragraph to be
        // dropped at the client — symptom: body looks empty (just heading
        // + subtitle, no body text) even though tools fire APPLIED.
        //
        // `sectionId` is optional. When omitted (or unknown) we target the
        // most recent section, matching the implicit-section fallback the
        // server-side `insertParagraph` already uses (PR #279). When no
        // sections exist yet the diff is dropped — there's no sensible
        // anchor for the paragraph to land on.
        //
        // Idempotent on `(paragraphId, text)`: replaying the same diff is
        // a no-op so an SSE replay storm doesn't churn renders.
        const payload = diff.payload as
          | { sectionId?: string; paragraphId?: string; text?: string }
          | undefined;
        if (!payload?.paragraphId || typeof payload.text !== "string") break;
        let tgt: CanvasSection | undefined;
        if (payload.sectionId) {
          tgt = next.sections.find((s) => s.id === payload.sectionId);
        }
        if (!tgt) {
          tgt = next.sections[next.sections.length - 1];
        }
        if (!tgt) break;
        if (!tgt.paragraphIds) tgt.paragraphIds = [];
        const idx = tgt.paragraphIds.indexOf(payload.paragraphId);
        if (idx !== -1) {
          // Idempotent: same id + same text is a no-op.
          if (tgt.paragraphs[idx] === payload.text) return prev;
          tgt.paragraphs[idx] = payload.text;
        } else {
          tgt.paragraphs.push(payload.text);
          tgt.paragraphIds.push(payload.paragraphId);
        }
        break;
      }
      default: {
        // Surface unknown diff kinds at WARN so a future server-side
        // additions doesn't silently strand the client (the W12.7
        // pattern this PR exists to fix). One structured log per
        // unrecognised kind — applied diffs are logged separately below.
        log.warn("Dropping unknown SSE diff kind", {
          kind: diff.type,
        });
        return prev;
      }
    }
    // Single structured log per applied diff so future debugging is one
    // grep away. Surfaces the canvas slot mutated (sectionId when
    // present) so ops can pair "section_updated" emissions with
    // their effect on the client canvas without re-instrumenting the
    // hook. Paragraph stats are included so the W23.D end-to-end trace
    // can confirm AI-inserted paragraphs actually landed on canvas
    // state — without this the only client-side evidence was a
    // sectionCount that ticks up but no proof the paragraph text
    // reached the section.
    const targetSectionId = extractSectionId(diff) ?? undefined;
    const targetSection = targetSectionId
      ? next.sections.find((s) => s.id === targetSectionId)
      : undefined;
    log.info("applied SSE diff", {
      kind: diff.type,
      sectionId: targetSectionId,
      sectionCount: next.sections.length,
      paragraphCount: targetSection?.paragraphs.length,
      paragraphIdCount: targetSection?.paragraphIds?.length,
    });
    return next;
  });
}
