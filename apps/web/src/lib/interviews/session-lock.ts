"use client";

import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:session-lock");

/**
 * Heartbeat cadence. Must be well below STALE_LOCK_THRESHOLD_MS on the server
 * (10s) so a healthy tab is never mistaken for abandoned.
 */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Treat a remote heartbeat as abandoned at the same threshold the server
 * uses. Allows the client to short-circuit a takeover without a 409 round-trip
 * when the existing lock is obviously stale.
 */
export const STALE_LOCK_THRESHOLD_MS = 10_000;

export interface SessionLockStatus {
  /** Heartbeat id of the current holder, or null when no lock exists. */
  holder: string | null;
  /** UNIX ms of the holder's most recent heartbeat, or null. */
  lastBeatAt: number | null;
  /** True when the existing lock is past the staleness threshold. */
  stale: boolean;
}

interface HeartbeatResponse {
  status: "acquired" | "refreshed" | "conflict";
  currentHolder?: string;
  previousHolder?: string;
  wasStale?: boolean;
  lastBeatAt?: number | null;
}

export interface SessionLockController {
  /** Stop heartbeating and release the lock on the server (best effort). */
  stop: () => Promise<void>;
  /** Force a takeover — the next heartbeat replaces any existing holder. */
  takeover: () => Promise<void>;
  /** The heartbeat id this controller is announcing. */
  heartbeatId: string;
}

interface StartHeartbeatInput {
  interviewId: string;
  heartbeatId: string;
  /** Called when the server reports another tab has taken over this lock. */
  onConflict: (info: { currentHolder: string }) => void;
  /** Skip the automatic first beat on construction (caller will trigger via takeover()). */
  skipInitialBeat?: boolean;
  /** Inject a fetch impl for tests. */
  fetchImpl?: typeof fetch;
}

function lockUrl(interviewId: string): string {
  return `/api/v1/interviews/${interviewId}/session-lock`;
}

/**
 * Generate a fresh heartbeat id for a tab. Combines the current time with a
 * 64-bit random suffix so collisions across rapid takeovers are negligible.
 */
export function generateHeartbeatId(): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `hb_${Date.now()}_${rand}`;
}

export async function fetchSessionLockStatus(input: {
  interviewId: string;
  fetchImpl?: typeof fetch;
}): Promise<SessionLockStatus> {
  const f = input.fetchImpl ?? fetch;
  const res = await f(lockUrl(input.interviewId), {
    method: "GET",
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error(`session-lock status fetch failed: ${res.status}`);
  }
  return (await res.json()) as SessionLockStatus;
}

async function postHeartbeat(input: {
  interviewId: string;
  heartbeatId: string;
  takeover: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; body: HeartbeatResponse } | { ok: false; status: number; body: HeartbeatResponse }> {
  const f = input.fetchImpl ?? fetch;
  const res = await f(lockUrl(input.interviewId), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      heartbeatId: input.heartbeatId,
      takeover: input.takeover,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as HeartbeatResponse;
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, body };
}

/**
 * Begin heartbeating ownership of the interview session. Returns a controller
 * that can release the lock on unmount and force a takeover after the user
 * confirms a conflict dialog.
 *
 * The very first heartbeat is sent immediately (no wait for the first
 * interval) so the lock document is created as early as possible.
 */
export function startSessionLockHeartbeat(input: StartHeartbeatInput): SessionLockController {
  const { interviewId, heartbeatId, onConflict, skipInitialBeat, fetchImpl } = input;
  let stopped = false;
  let forceTakeoverNext = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const sendBeat = async () => {
    if (stopped) return;
    const takeover = forceTakeoverNext;
    forceTakeoverNext = false;
    try {
      const result = await postHeartbeat({
        interviewId,
        heartbeatId,
        takeover,
        fetchImpl,
      });
      if (!result.ok && result.status === 409) {
        const currentHolder = result.body.currentHolder ?? "unknown";
        log.warn("Session lock taken over by another tab", {
          interviewId,
          ourHeartbeatId: heartbeatId,
          currentHolder,
        });
        stopped = true;
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        onConflict({ currentHolder });
      }
    } catch (err) {
      // Network errors are non-fatal — we keep heartbeating; the server will
      // either accept the next beat or surface a conflict.
      log.warn("Heartbeat send failed", {
        interviewId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (!skipInitialBeat) void sendBeat();
  intervalId = setInterval(() => {
    void sendBeat();
  }, HEARTBEAT_INTERVAL_MS);

  return {
    heartbeatId,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      const f = fetchImpl ?? fetch;
      try {
        await f(
          `${lockUrl(interviewId)}?heartbeatId=${encodeURIComponent(heartbeatId)}`,
          {
            method: "DELETE",
            credentials: "same-origin",
          },
        );
      } catch (err) {
        log.warn("Failed to release session lock on stop", {
          interviewId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    takeover: async () => {
      forceTakeoverNext = true;
      await sendBeat();
    },
  };
}
