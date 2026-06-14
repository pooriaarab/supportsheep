import { getDb } from "@/db";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { listEventsSince, type EventCursor } from "@/lib/interviews/events-repository";
import {
  verifyInterviewToken,
  getInterviewTokenCookieName,
} from "@/lib/interviews/interview-token";
import { getOrCreateWorker } from "@/lib/interviews/writer-worker-registry";
import { updateInterview } from "@/lib/interviews/interviews-repository";
import { getProviderApiKey } from "@/lib/ai/providers";
import { type InterviewLanguage } from "@/lib/interviews/share-link-schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:stream");

/**
 * Route segment config. Two things matter here for SSE stability:
 *
 * 1. `dynamic = "force-dynamic"` — Next.js must not attempt any static
 *    optimisation or response caching for an SSE handler. Without it,
 *    Next's build pipeline can mark the route as cacheable and break the
 *    event stream entirely.
 *
 * 2. `maxDuration = 300` — root cause of the production "stream lost"
 *    backoff loop. PR #207 added a 15 s keepalive so Netlify's *idle*
 *    proxy timeout (~30 s with no bytes) would not fire. That works.
 *    But Netlify Functions also enforce an absolute *maximum* function
 *    duration that no keepalive can extend; on Netlify Functions the
 *    default cap is 10 s for synchronous responses and only goes up if
 *    the route opts in via the standard Next.js `maxDuration` route
 *    segment config (which `@netlify/plugin-nextjs` translates to the
 *    function's hard timeout). 300 s is the maximum supported on the
 *    Pro plan, which comfortably covers our 5–10 min interviews.
 *    Without this opt-in the function is killed mid-stream, the client
 *    sees a clean EOF, backs off ~500 ms, and reconnects in a loop —
 *    exactly the production symptom.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Heartbeat interval for SSE keep-alive comments. Prevents Netlify's *idle*
// proxy timeout from firing during long quiet periods (no writer diffs, no
// canvas events). Does NOT extend the function's absolute max duration —
// that is controlled by `maxDuration` above.
//
// Tightened from 10 s to 5 s after PR #286's 10 s cadence still produced
// production drops every ~25–30 s (W22 logs: `elapsedSinceMountMs:41699`
// first loss, then ~23 s intervals). The proxy-layer behaviour we are
// defending against is twofold: (1) Netlify's edge has been observed to
// idle-close some streams around 25–30 s under load, and (2) intermediate
// network paths (cell carriers, captive portals, corporate proxies) often
// hold a 25 s idle limit. A 5 s cadence gives at least 5 keepalive
// chances inside any 30 s window, so a single dropped packet can no
// longer push us past the threshold. The matching `X-Accel-Buffering: no`
// response header is the other half of the fix: without it the proxy can
// hold the keepalive byte in its buffer and idle-close the upstream
// connection even though the keepalive technically fired on schedule.
const KEEPALIVE_INTERVAL_MS = 5_000;

/**
 * D1 poll interval. D1 has no realtime push (no onSnapshot equivalent), so
 * the SSE route polls `listEventsSince` on a fixed cadence. 600 ms gives a
 * good balance between latency and D1 read cost. This adds up to ~600 ms
 * worst-case SSE delivery latency per event batch (vs. the ~50–100 ms
 * Firestore onSnapshot latency), which is imperceptible to users. If lower
 * latency is required in future, the replacement is Cloudflare Durable
 * Objects with WebSocket push — not in scope for this migration (0B).
 */
const POLL_INTERVAL_MS = 600;

/**
 * Kinds that the stream forwards to the client. Mirrors the Firestore `in`
 * filter that the previous onSnapshot query used. Keeping this set narrow
 * prevents transcript/canvas_update events (which are high-volume in a live
 * session) from flooding the SSE channel with events the client doesn't need.
 */
const STREAM_KINDS: string[] = [
  "canvas_update",
  "writer_update",
  "writer_diff",
  "tool_call",
  "tool_failed",
  "tool_result",
  "tool_in_flight",
  "tool_completed",
  "canvas_edit",
];

/**
 * Reason the stream was closed. Always logged once per connection so ops
 * can reconstruct why a client saw a disconnect:
 *
 * - `client_disconnect` — the browser closed (tab close, navigation, or
 *   the client's managed-reconnect tore down the EventSource).
 * - `poll_error` — the D1 `listEventsSince` poll threw repeatedly without
 *   recovering. Distinct from a one-off transient error (which we tolerate)
 *   so ops can tell a stuck poll from an occasional blip.
 * - `provider_key_error` — Claude API key fetch failed during startup.
 * - `enqueue_failed` — `controller.enqueue` threw (stream already torn
 *   down by the runtime — strong signal of a function timeout or proxy
 *   reset).
 * - `startup_error` — an exception was thrown synchronously inside the
 *   `ReadableStream.start()` body before the per-failure handlers had a
 *   chance to attach.
 * - `unknown` — close was triggered without recording a reason; should
 *   not happen in normal operation.
 */
type StreamCloseReason =
  | "client_disconnect"
  | "poll_error"
  | "provider_key_error"
  | "enqueue_failed"
  | "startup_error"
  | "unknown";

/**
 * Resolve the interview token from the request. Preferred path is the
 * `interview_token_<id>` HttpOnly cookie set by /consent (F-006). The query
 * string is accepted only as a deprecated fallback so an in-flight client
 * release does not break — but the fallback is loud (warning log) and can be
 * disabled entirely via `INTERVIEW_REJECT_QUERY_TOKEN=true` once all clients
 * have shipped.
 *
 * TODO(F-006 cleanup): remove the query-string fallback once telemetry shows
 * no `interviews:stream:query-token-fallback` warnings for a release cycle,
 * then delete this helper's `searchParams` branch.
 */
function resolveInterviewToken(
  request: Request,
  interviewId: string,
): { token: string; source: "cookie" | "query" } | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieName = getInterviewTokenCookieName(interviewId);
  // Manual cookie parse — we only need one specific cookie and don't want a
  // dependency for it. Cookies are `name=value; name2=value2` pairs.
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== cookieName) continue;
    const value = part.slice(eq + 1).trim();
    if (value) {
      return { token: decodeURIComponent(value), source: "cookie" };
    }
  }

  if (process.env.INTERVIEW_REJECT_QUERY_TOKEN === "true") {
    return null;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    return { token: queryToken, source: "query" };
  }
  return null;
}

/**
 * Build an SSE response that emits a single structured `event: error` frame
 * with a JSON payload, then closes. Used for non-2xx close paths (missing
 * cookie, expired/forged token, cross-interview token) so the browser-side
 * EventSource sees the reason BEFORE the connection drops rather than only
 * a bare HTTP status and an immediate EOF.
 *
 * Without this the client cannot distinguish "auth cookie not sent yet —
 * retry, the browser will probably attach it on the next attempt" from
 * "this token is permanently invalid — surface to UI". The post-magic-link
 * SameSite=Strict cookie race in particular looks identical to a hard 401
 * over the wire today, which drives the connect-time backoff loop.
 *
 * Status code is left at 200 so the EventSource considers the connection
 * "open" long enough to deliver the error frame; the reason + retryable
 * flag in the payload tell the client what to do next. The HTTP status is
 * shadowed in `code` for ops parity.
 */
function buildSseAuthErrorResponse(args: {
  reason: "auth_missing" | "auth_invalid" | "auth_cross_interview";
  code: 401 | 403;
  retryable: boolean;
}): Response {
  const body = `event: error\ndata: ${JSON.stringify({
    reason: args.reason,
    code: args.code,
    retryable: args.retryable,
  })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Mirror the main stream's anti-buffering hint so the single
      // error frame reaches the client immediately even when the
      // intermediate proxy would otherwise hold a small response in
      // its buffer until the next byte arrives.
      "X-Accel-Buffering": "no",
    },
  });
}

export const GET = async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const resolved = resolveInterviewToken(request, id);
  if (!resolved) {
    // Connect-time cookie race: SameSite=Lax cookies from a magic-link nav
    // can miss the very first same-site EventSource if the browser hadn't
    // attached the cookie store yet. Tell the client this is retryable so
    // its existing backoff catches the next attempt instead of surfacing
    // a hard error to the UI.
    return buildSseAuthErrorResponse({
      reason: "auth_missing",
      code: 401,
      retryable: true,
    });
  }
  if (resolved.source === "query") {
    log.warn(
      "interviews:stream:query-token-fallback — client still sending interview token in query string (F-006)",
      { interviewId: id },
    );
  }
  const payload = verifyInterviewToken(resolved.token);
  if (!payload || payload.interviewId !== id) {
    // Distinguish a valid-but-cross-interview cookie (403) from a missing or
    // expired token (401). Helps the client surface "this link is for a
    // different interview" without exposing why the token was rejected.
    if (payload && payload.interviewId !== id) {
      // Cross-interview cookie is a permanent error — the wrong magic link.
      // Not retryable: the client should surface to the UI immediately.
      return buildSseAuthErrorResponse({
        reason: "auth_cross_interview",
        code: 403,
        retryable: false,
      });
    }
    // Token was present but failed HMAC verification or is expired. This is
    // a hard failure (forged token or 30+ min stale) — not retryable.
    return buildSseAuthErrorResponse({
      reason: "auth_invalid",
      code: 401,
      retryable: false,
    });
  }

  const startedAt = Date.now();

  // SSE `Last-Event-ID` resume cursor. EventSource attaches this header
  // automatically on every reconnect, carrying the `id:` value of the most
  // recent event the client successfully processed. We use the event's `ts`
  // (ISO-8601 string, lexicographically sortable) as the SSE event id, so a
  // `Last-Event-ID: 2026-05-22T17:51:28.453Z` lets us filter the D1 query
  // to only events strictly after that timestamp. Without this filter every
  // reconnect re-fans every prior event — the production "section appears 3x"
  // bug. Defensive parsing: an empty or non-string header is treated as
  // "no cursor" so a malformed value can't strand the client.
  const lastEventIdHeader = request.headers.get("last-event-id");
  const lastEventIdCursor =
    typeof lastEventIdHeader === "string" && lastEventIdHeader.length > 0
      ? lastEventIdHeader
      : null;

  log.info("SSE stream opened", {
    interviewId: id,
    lastEventId: lastEventIdCursor,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let workerCleanup: (() => void) | null = null;
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const close = (
        reason: StreamCloseReason,
        details?: { errorMessage?: string; errorCode?: string; errorStack?: string },
      ) => {
        if (closed) return;
        closed = true;
        log.info("SSE stream closed", {
          interviewId: id,
          durationMs: Date.now() - startedAt,
          closeReason: reason,
          ...(details?.errorMessage ? { errorMessage: details.errorMessage } : {}),
          ...(details?.errorCode ? { errorCode: details.errorCode } : {}),
          ...(details?.errorStack ? { errorStack: details.errorStack } : {}),
        });
        try {
          workerCleanup?.();
        } catch {
          // ignore
        }
        if (pollTimer !== null) {
          try {
            clearTimeout(pollTimer);
          } catch {
            // ignore
          }
          pollTimer = null;
        }
        if (keepaliveTimer !== null) {
          try {
            clearInterval(keepaliveTimer);
          } catch {
            // ignore
          }
          keepaliveTimer = null;
        }
        try {
          controller.close();
        } catch {
          // ignore — controller may already be in a terminal state
        }
      };

      // Wire the client-disconnect signal first so an early `close()` from
      // within `start()` doesn't lose the cleanup hook.
      request.signal.addEventListener("abort", () => close("client_disconnect"));

      // Tracks the timestamp of the most recent byte we wrote to the
      // controller (any `send()` event OR a keepalive comment).
      let lastEventAt = Date.now();
      const send = (event: string, data: unknown, eventId?: string) => {
        if (closed) return;
        const idLine = eventId ? `id: ${eventId}\n` : "";
        const frame = `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(frame));
        lastEventAt = Date.now();
        log.debug("sse_event_forwarded", {
          interviewId: id,
          eventId: eventId ?? null,
          kind: event,
          payloadSize: frame.length,
        });
      };

      // Wrap the entire startup body so a synchronous throw surfaces as a
      // structured `startup_error` close instead of silently dropping the stream.
      try {
        send("hello", { interviewId: id });

        // SSE comment lines (any line starting with `:`) are ignored by clients,
        // but they keep the TCP connection alive and reset proxy idle timers so
        // Netlify doesn't kill the stream after ~30s of no traffic.
        keepaliveTimer = setInterval(() => {
          if (closed) return;
          try {
            const now = Date.now();
            controller.enqueue(encoder.encode(`: keepalive ${now}\n\n`));
            log.debug("interviews:stream keepalive", {
              interviewId: id,
              sinceOpenMs: now - startedAt,
              msSinceLastEvent: now - lastEventAt,
            });
            lastEventAt = now;
          } catch {
            close("enqueue_failed");
          }
        }, KEEPALIVE_INTERVAL_MS);

        // D1 poll-loop. Replaces Firestore onSnapshot.
        //
        // Rationale: D1 does not offer a realtime push mechanism. The SSE
        // route instead polls `listEventsSince` every POLL_INTERVAL_MS and
        // emits an SSE frame per new event, with the same `id:`/`data:`
        // framing as the previous Firestore onSnapshot path. The browser
        // EventSource client is unchanged — only added ~600 ms delivery
        // latency per event batch (vs. ~50–100 ms with Firestore push).
        //
        // Cursor correctness: we track a compound (ts, id) cursor so no
        // event is dropped or double-emitted even when multiple events share
        // the same millisecond-precision ts. See events-repository.ts for
        // the compound WHERE clause that implements this invariant.
        //
        // Future: replace with Cloudflare Durable Objects + WebSocket push
        // for sub-100 ms delivery. Out of scope for 0B.

        // Initial cursor from Last-Event-ID header (resume after reconnect).
        // The SSE event id is the event `ts` string. On the first connect
        // there is no cursor; on reconnect the browser sends the last-seen ts.
        // We seed afterId="" so compound cursor logic (ts > afterTs) OR
        // (ts = afterTs AND id > afterId) works correctly from an empty id.
        let cursor: EventCursor | undefined = lastEventIdCursor
          ? { afterTs: lastEventIdCursor, afterId: "" }
          : undefined;

        const schedulePoll = () => {
          if (closed) return;
          pollTimer = setTimeout(() => {
            void runPoll();
          }, POLL_INTERVAL_MS);
        };

        const runPoll = async () => {
          if (closed) return;
          pollTimer = null;
          try {
            const rows = await listEventsSince(
              "default",
              id,
              { cursor, kinds: STREAM_KINDS, limit: 200 },
              getDb(),
            );
            for (const row of rows) {
              if (closed) break;
              const kind = row.kind;
              const eventTs = row.ts;
              if (kind === "writer_diff") {
                const diffPayload = row.payload as { type?: string } | null;
                log.info("forwarded_writer_diff", {
                  interviewId: id,
                  eventId: row.id,
                  diffType: diffPayload?.type,
                });
              }
              // Pass the event's `ts` as the SSE event id so the
              // browser stores it and replays it as `Last-Event-ID` on
              // the next reconnect.
              send(kind, row.payload, eventTs);
              // Advance the compound cursor to the last event we just emitted.
              cursor = { afterTs: row.ts, afterId: row.id };
            }
          } catch (err: unknown) {
            const pollErr = err as Error;
            log.warn("interviews:stream poll error (non-fatal)", {
              interviewId: id,
              errorMessage: pollErr.message,
            });
          }
          schedulePoll();
        };

        // Kick off the first poll immediately (before the first POLL_INTERVAL
        // elapses) so events produced before the SSE connects are delivered
        // promptly rather than waiting up to 600 ms.
        schedulePoll();

        // Subscribe to writer worker diffs and load interview context.
        const blogId = "default";
        const interviewRow = await getInterview(blogId, id, getDb());
        const interviewData = interviewRow
          ? {
              topic: interviewRow.topic,
              goal: interviewRow.goal,
              language: interviewRow.language as InterviewLanguage | undefined,
              canvasSnapshot: interviewRow.canvasSnapshot as import("@/lib/interviews/writer-worker").CanvasState | null | undefined,
            }
          : {};

        let apiKey: string;
        try {
          apiKey = await getProviderApiKey("claude");
        } catch (err) {
          send("error", {
            message:
              err instanceof Error
                ? err.message
                : "Claude API key not configured",
          });
          close("provider_key_error");
          return;
        }
        const worker = getOrCreateWorker({
          interviewId: id,
          topic: interviewData.topic ?? undefined,
          goal: interviewData.goal ?? undefined,
          language: interviewData.language,
          apiKey,
          // Cold-lambda rehydration: when a fresh /stream instance picks
          // up an interview that was being processed elsewhere, seed the
          // worker with the persisted canvas so subscribers see prior
          // sections/paragraphs immediately rather than an empty canvas
          // until the next writer_diff poll event lands.
          hydrateFrom: interviewData.canvasSnapshot ?? null,
        });

        // Debounced canvas snapshot persistence for page-refresh recovery.
        // Each writer diff flips `snapshotDirty=true`; a single 1s-debounced
        // flush writes the latest canvas to D1 interviews row so a
        // refresh-recovery GET can rehydrate the canvas without replaying
        // every D1 event. Capped to one write/second per stream
        // connection to keep write cost bounded under heavy diff bursts.
        let snapshotDirty = false;
        let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
        const CANVAS_SNAPSHOT_DEBOUNCE_MS = 1_000;
        const flushSnapshot = async () => {
          snapshotDirty = false;
          try {
            const canvas = worker.getCanvas();
            await updateInterview(blogId, id, {
              canvasSnapshot: canvas as unknown as Record<string, unknown>,
              canvasSnapshotAt: Date.now(),
            }, getDb());
          } catch (err) {
            log.warn("canvas snapshot write failed (non-fatal)", {
              interviewId: id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        };
        const scheduleSnapshot = () => {
          snapshotDirty = true;
          if (snapshotTimer !== null) return;
          snapshotTimer = setTimeout(() => {
            snapshotTimer = null;
            if (snapshotDirty) void flushSnapshot();
          }, CANVAS_SNAPSHOT_DEBOUNCE_MS);
        };

        const onDiff = () => {
          // writer_diff SSE delivery is handled exclusively via the D1
          // poll loop (runPoll picks up writer_diff rows) to avoid
          // duplicate delivery when the worker is colocated on the same
          // instance as this SSE route.
          scheduleSnapshot();
        };
        const unsubscribeDiff = worker.subscribe(onDiff);
        workerCleanup = () => {
          unsubscribeDiff();
          if (snapshotTimer !== null) {
            clearTimeout(snapshotTimer);
            snapshotTimer = null;
          }
          // Final flush so the very last diff survives a disconnect.
          if (snapshotDirty) void flushSnapshot();
        };
      } catch (err) {
        const startupError = err as Error & { code?: string };
        log.error("SSE startup failed — closing stream", {
          interviewId: id,
          errorMessage: startupError?.message,
          errorCode: startupError?.code,
          errorStack: startupError?.stack,
        });
        close("startup_error", {
          errorMessage: startupError?.message,
          errorCode: startupError?.code,
          errorStack: startupError?.stack,
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Disable proxy-layer response buffering. Netlify (and the nginx-
      // based reverse proxies it sits behind for some routes) honours
      // the de-facto `X-Accel-Buffering: no` hint to stream bytes
      // straight through instead of accumulating them in a buffer.
      // Without this our 5 s keepalive comment lines can be held by
      // the proxy until either the buffer fills or its idle timeout
      // fires — the exact symptom in production where the function
      // logs `interviews:stream keepalive` every 5–10 s but the
      // browser still sees `SSE stream lost — backing off` every
      // ~25–30 s. Belt for the suspenders of `Cache-Control:
      // no-transform`, which some intermediaries do not honour.
      "X-Accel-Buffering": "no",
    },
  });
};
