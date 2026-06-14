/**
 * Test-only mock OpenAI Realtime timeline endpoint.
 *
 * GET /api/v1/interviews/test-only/mock-realtime-timeline
 *   ?interview=<id>&mode=<basic|comprehensive>
 *
 * Streams a Server-Sent Events feed of canned realtime data-channel events
 * at human-paced offsets. The client adapter
 * (`MockScriptedRealtimeClient`) consumes this and re-emits the events
 * through the same listener surface as the real `RealtimeClient`, so the
 * dev interview harness can drive the consent → live → idle flow end-to-end
 * without ever opening a WebRTC peer to OpenAI.
 *
 * Gated by BOTH `LLM_PROVIDER=mock` AND `NODE_ENV !== "production"`. Either
 * gate failing returns 404 — the route must be inert in real production
 * even if `LLM_PROVIDER=mock` leaks into a deploy environment.
 *
 * Each emitted SSE event looks like:
 *   event: timeline
 *   data: {"delayMs":3500,"kind":"tool_call","name":"set_title",…}
 *
 * Plus a final:
 *   event: done
 *   data: {"ok":true}
 *
 * after the script completes.
 */

import { NextResponse } from "next/server";
import {
  getMockRealtimeTimeline,
  getMockRealtimeTimelineDurationMs,
  type MockTimelineEvent,
  type MockTimelineMode,
} from "@/lib/interviews/mock-realtime-timelines";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:interviews:test-only:mock-realtime-timeline");

export const dynamic = "force-dynamic";
// Cover the longest comprehensive timeline (~60s) plus tail buffer for
// keepalives. Same opt-in pattern the live SSE stream uses to survive
// Netlify's per-function default cap.
export const maxDuration = 120;

const KEEPALIVE_INTERVAL_MS = 15_000;

/**
 * Single source of truth for the gate check. Both `LLM_PROVIDER=mock` AND
 * `NODE_ENV !== "production"` must be true; either failing returns 404.
 */
function isMockTimelineEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LLM_PROVIDER === "mock"
  );
}

function parseMode(raw: string | null): MockTimelineMode {
  return raw === "comprehensive" ? "comprehensive" : "basic";
}

export const GET = async (request: Request): Promise<Response> => {
  if (!isMockTimelineEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const interviewId = url.searchParams.get("interview");
  if (!interviewId) {
    return NextResponse.json(
      { error: "missing required ?interview= param" },
      { status: 400 },
    );
  }
  const mode = parseMode(url.searchParams.get("mode"));
  const events = getMockRealtimeTimeline(mode);

  log.info("mock realtime timeline opened", {
    interviewId,
    mode,
    eventCount: events.length,
    durationMs: getMockRealtimeTimelineDurationMs(mode),
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const close = (reason: string): void => {
        if (closed) return;
        closed = true;
        for (const t of timers) {
          try {
            clearTimeout(t);
          } catch {
            // ignore
          }
        }
        if (keepaliveTimer !== null) {
          try {
            clearInterval(keepaliveTimer);
          } catch {
            // ignore
          }
          keepaliveTimer = null;
        }
        log.info("mock realtime timeline closed", {
          interviewId,
          mode,
          closeReason: reason,
        });
        try {
          controller.close();
        } catch {
          // controller already terminal
        }
      };

      request.signal.addEventListener("abort", () =>
        close("client_disconnect"),
      );

      const send = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          close("enqueue_failed");
        }
      };

      send("hello", { interviewId, mode, eventCount: events.length });

      keepaliveTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          close("enqueue_failed");
        }
      }, KEEPALIVE_INTERVAL_MS);

      for (const event of events) {
        const handle = setTimeout(() => {
          if (closed) return;
          send("timeline", event satisfies MockTimelineEvent);
        }, event.delayMs);
        timers.push(handle);
      }

      // Send `done` ~250 ms after the last scripted event so the client has
      // a single deterministic signal to tear down its EventSource.
      const lastDelay = events.reduce(
        (max, e) => (e.delayMs > max ? e.delayMs : max),
        0,
      );
      const doneTimer = setTimeout(() => {
        if (closed) return;
        send("done", { ok: true });
        close("script_complete");
      }, lastDelay + 250);
      timers.push(doneTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
};
