import "server-only";

import { appendEvents } from "@/lib/interviews/events-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";
import type { ToolResult } from "./_types";

const log = createLogger("interviews:tools:narration");

/**
 * Narration event emitters. These write `tool_result`, `tool_in_flight`,
 * and `tool_completed` events to the per-interview `events` subcollection
 * so the SSE stream can surface them to the client, which in turn pushes
 * a system narration cue down the WebRTC data channel to the realtime
 * model. Without these cues the AI dispatches a tool and goes silent
 * for the duration of the call — the user, who can't see the canvas,
 * thinks the experience is broken.
 *
 * Lives in its own module (instead of `tools/index.ts`) so the
 * fire-and-forget tools can import `emitFireAndForgetCompletion`
 * without creating a circular dependency: `tools/index.ts` imports
 * every tool, so any tool importing from `tools/index.ts` would
 * cycle.
 */

/**
 * Emit a `tool_result` event when a sync tool finishes. The client
 * surfaces this on the realtime data channel as a brief system
 * message ("title applied: X" / "section added") so the AI can
 * narrate the outcome instead of going silent.
 */
export async function emitToolResultEvent(
  interviewId: string,
  toolName: string,
  callId: string | undefined,
  result: ToolResult,
): Promise<void> {
  try {
    log.info("emit-tool-result", {
      interviewId,
      toolName,
      callId,
      ok: result.ok,
      ...(result.ok
        ? { summary: result.summary ?? "ok" }
        : { errorKind: result.category }),
    });
    await appendEvents(DEFAULT_BLOG_ID, interviewId, [
      {
        ts: new Date().toISOString(),
        kind: "tool_result",
        payload: result.ok
          ? {
              toolName,
              callId: callId ?? null,
              ok: true,
              summary: result.summary ?? "ok",
            }
          : {
              toolName,
              callId: callId ?? null,
              ok: false,
              errorKind: result.category,
              message: result.message,
            },
      },
    ]);
  } catch (err: unknown) {
    log.warn("emit-tool-result-failed", {
      interviewId,
      toolName,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Emit a `tool_in_flight` event the instant a fire-and-forget tool
 * is dispatched. The client surfaces this as a system message
 * telling the AI to keep the user engaged through the upstream
 * round-trip ("this'll take a few seconds").
 */
export async function emitToolInFlightEvent(
  interviewId: string,
  toolName: string,
  callId: string | undefined,
): Promise<void> {
  try {
    log.info("emit-tool-in-flight", { interviewId, toolName, callId });
    await appendEvents(DEFAULT_BLOG_ID, interviewId, [
      {
        ts: new Date().toISOString(),
        kind: "tool_in_flight",
        payload: {
          toolName,
          callId: callId ?? null,
        },
      },
    ]);
  } catch (err: unknown) {
    log.warn("emit-tool-in-flight-failed", {
      interviewId,
      toolName,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Emit a `tool_completed` event when a fire-and-forget tool's
 * background work finishes. The client surfaces this as a narration
 * cue so the AI can tell the user "the image is ready" instead of
 * silently moving on.
 *
 * Called from inside the fire-and-forget tool handler's background
 * promise — the dispatcher returns before that promise resolves so
 * the dispatcher itself can't emit this signal.
 */
export async function emitFireAndForgetCompletion(
  interviewId: string,
  toolName: string,
  outcome:
    | { ok: true; summary: string }
    | { ok: false; message: string },
): Promise<void> {
  try {
    log.info("emit-tool-completed", {
      interviewId,
      toolName,
      ok: outcome.ok,
      ...(outcome.ok
        ? { summary: outcome.summary }
        : { message: outcome.message }),
    });
    await appendEvents(DEFAULT_BLOG_ID, interviewId, [
      {
        ts: new Date().toISOString(),
        kind: "tool_completed",
        payload: {
          toolName,
          ok: outcome.ok,
          ...(outcome.ok
            ? { summary: outcome.summary }
            : { message: outcome.message }),
        },
      },
    ]);
  } catch (err: unknown) {
    log.warn("emit-tool-completed-failed", {
      interviewId,
      toolName,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
