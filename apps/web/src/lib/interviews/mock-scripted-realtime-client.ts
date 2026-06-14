"use client";

import { createLogger } from "@/lib/logger";
import type {
  RealtimeClientEvents,
  RealtimeClientState,
  RealtimeConversationState,
} from "./realtime-client";
import type { MockTimelineEvent } from "./mock-realtime-timelines";

const log = createLogger("interviews:mock-scripted-realtime-client");

/**
 * Token prefix the server-side `consent` route uses for mock sessions
 * (e.g. `mock-${interviewId}`). The real `RealtimeClient.connect` branches
 * on this prefix to spawn a `MockScriptedRealtimeClient` instead of opening
 * a WebRTC peer to OpenAI.
 */
export const MOCK_REALTIME_TOKEN_PREFIX = "mock-";

/**
 * Reads `mock-<interviewId>[?mode=basic|comprehensive]` and returns the
 * fragments needed to open an SSE connection. Returns null if the token
 * does not match the mock prefix.
 *
 * Embedding the mode in the token lets the server emit the same mock
 * timeline shape it chose at consent time, without an extra round-trip.
 */
export function parseMockRealtimeToken(token: string): {
  interviewId: string;
  mode: "basic" | "comprehensive";
} | null {
  if (!token.startsWith(MOCK_REALTIME_TOKEN_PREFIX)) return null;
  const rest = token.slice(MOCK_REALTIME_TOKEN_PREFIX.length);
  // Mode is appended with a `:` separator, e.g. `mock-abc123:comprehensive`,
  // so the interview id keeps its UUID characters untouched.
  const sep = rest.indexOf(":");
  if (sep === -1) {
    return { interviewId: rest, mode: "basic" };
  }
  const interviewId = rest.slice(0, sep);
  const modeRaw = rest.slice(sep + 1);
  const mode = modeRaw === "comprehensive" ? "comprehensive" : "basic";
  return { interviewId, mode };
}

type ConversationDataChannelType = Extract<
  MockTimelineEvent,
  { kind: "conversation_state" }
>["type"];

/**
 * The conversation-state mapping the real `RealtimeClient` uses when it
 * receives a given data-channel `type`. Centralised here so the mock and
 * real client cannot drift.
 */
function conversationStateForType(
  type: ConversationDataChannelType,
): RealtimeConversationState {
  switch (type) {
    case "input_audio_buffer.speech_started":
      return "user_speaking";
    case "input_audio_buffer.committed":
      return "ai_thinking";
    case "response.created":
      return "ai_thinking";
    case "response.audio.delta":
      return "ai_speaking";
    case "response.done":
      return "ai_done";
    default:
      // exhaustive — TypeScript catches missing cases at compile time
      return "ai_done";
  }
}

interface MockScriptedClientOptions {
  /** Override the SSE base path. Defaults to the test-only timeline route. */
  baseUrl?: string;
  /** Inject a custom EventSource factory (used by tests). */
  eventSourceFactory?: (url: string) => EventSource;
}

/**
 * Drop-in replacement for `RealtimeClient` that drives the consent → live
 * → idle flow off the server-side scripted timeline endpoint.
 *
 * Does NOT open a WebRTC peer, does NOT touch `getUserMedia`, and does NOT
 * call `api.openai.com`. The surface matches `RealtimeClient` so callers
 * (`use-interview-session.ts`) cannot tell which one they got.
 */
export class MockScriptedRealtimeClient {
  private events: RealtimeClientEvents;
  private state: RealtimeClientState = "idle";
  private lastConversationState: RealtimeConversationState | null = null;
  private es: EventSource | null = null;
  private eventSourceFactory: (url: string) => EventSource;
  private baseUrl: string;

  constructor(
    events: RealtimeClientEvents,
    options: MockScriptedClientOptions = {},
  ) {
    this.events = events;
    this.baseUrl =
      options.baseUrl ?? "/api/v1/interviews/test-only/mock-realtime-timeline";
    this.eventSourceFactory =
      options.eventSourceFactory ??
      ((url: string) => new EventSource(url, { withCredentials: true }));
  }

  async connect(input: { ephemeralToken: string }): Promise<void> {
    const parsed = parseMockRealtimeToken(input.ephemeralToken);
    if (!parsed) {
      // Defensive — should never reach here because `RealtimeClient.connect`
      // is the only branch that constructs us, and it only does so when
      // the token already matches the mock prefix.
      const err = new Error(
        "MockScriptedRealtimeClient requires a mock-prefixed token",
      );
      this.setState("error");
      throw err;
    }

    this.setState("connecting");

    const url = `${this.baseUrl}?interview=${encodeURIComponent(parsed.interviewId)}&mode=${parsed.mode}`;
    log.info("Opening mock scripted realtime timeline", {
      interviewId: parsed.interviewId,
      mode: parsed.mode,
    });

    let es: EventSource;
    try {
      es = this.eventSourceFactory(url);
    } catch (err) {
      this.setState("error");
      throw err;
    }
    this.es = es;

    es.addEventListener("hello", () => {
      this.setState("live");
    });

    es.addEventListener("timeline", (ev) => {
      const message = ev as MessageEvent;
      try {
        const event = JSON.parse(message.data) as MockTimelineEvent;
        this.dispatchTimelineEvent(event);
      } catch (parseErr) {
        log.error("Failed to parse mock timeline event", {
          error: parseErr,
          raw: message.data,
        });
      }
    });

    es.addEventListener("done", () => {
      log.info("Mock scripted realtime timeline complete");
      this.disconnect();
    });

    es.onerror = (err) => {
      // EventSource will auto-retry on intermittent failures; the mock
      // endpoint is local and shouldn't drop, so any error here is
      // structurally bad — surface it.
      log.warn("Mock scripted realtime EventSource error", { error: err });
    };
  }

  mute(muted: boolean): void {
    log.info("mute() called on mock client (no-op)", { muted });
  }

  disconnect(): void {
    this.setState("ended");
    try {
      this.es?.close();
    } catch {
      // ignore
    }
    this.es = null;
  }

  forceEnd(): void {
    this.disconnect();
  }

  private emitConversationState(next: RealtimeConversationState): void {
    if (this.lastConversationState === next) return;
    this.lastConversationState = next;
    this.events.onConversationState?.(next);
  }

  private dispatchTimelineEvent(event: MockTimelineEvent): void {
    switch (event.kind) {
      case "conversation_state":
        this.emitConversationState(conversationStateForType(event.type));
        break;
      case "transcript":
        this.events.onTranscript({ role: event.role, text: event.text });
        break;
      case "tool_call":
        this.events.onToolCall({
          name: event.name,
          arguments: event.arguments,
          callId: event.callId,
        });
        break;
      case "usage":
        this.events.onUsage({
          input_tokens: event.input_tokens,
          output_tokens: event.output_tokens,
        });
        break;
      case "idle":
        // Drop back to the ambient `ai_done` so the orb returns to its
        // listening pulse before the `done` SSE event tears us down.
        this.emitConversationState("ai_done");
        break;
    }
  }

  private setState(s: RealtimeClientState): void {
    this.state = s;
    this.events.onStateChange(s);
  }

  /**
   * Test-only accessor. Production callers don't need to read state since
   * they observe transitions via `onStateChange`.
   */
  getStateForTest(): RealtimeClientState {
    return this.state;
  }
}
