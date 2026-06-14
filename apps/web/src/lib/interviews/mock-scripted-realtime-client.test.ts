import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockScriptedRealtimeClient,
  parseMockRealtimeToken,
} from "./mock-scripted-realtime-client";
import type { MockTimelineEvent } from "./mock-realtime-timelines";

/**
 * Minimal in-memory EventSource stand-in. Real `EventSource` is a browser-only
 * global that vitest's node env doesn't provide, and we want to drive events
 * synchronously from the test rather than wait on a real HTTP stream.
 */
class FakeEventSource {
  url: string;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  onerror: ((ev: unknown) => void) | null = null;
  closed = false;
  static last: FakeEventSource | null = null;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }

  addEventListener(name: string, cb: (ev: MessageEvent) => void): void {
    const list = this.listeners.get(name) ?? [];
    list.push(cb);
    this.listeners.set(name, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(name: string, data: unknown): void {
    const list = this.listeners.get(name) ?? [];
    const ev = { data: JSON.stringify(data) } as MessageEvent;
    for (const cb of list) cb(ev);
  }
}

function buildEvents() {
  return {
    onTranscript: vi.fn(),
    onToolCall: vi.fn(),
    onAudioLevel: vi.fn(),
    onStateChange: vi.fn(),
    onConversationState: vi.fn(),
    onUsage: vi.fn(),
  };
}

describe("parseMockRealtimeToken", () => {
  it("returns null for tokens that don't start with the mock prefix", () => {
    expect(parseMockRealtimeToken("sk-real-key")).toBeNull();
    expect(parseMockRealtimeToken("")).toBeNull();
  });

  it("parses mock-<interviewId> with default basic mode", () => {
    expect(parseMockRealtimeToken("mock-abc-123")).toEqual({
      interviewId: "abc-123",
      mode: "basic",
    });
  });

  it("parses the comprehensive mode suffix", () => {
    expect(parseMockRealtimeToken("mock-abc-123:comprehensive")).toEqual({
      interviewId: "abc-123",
      mode: "comprehensive",
    });
  });

  it("falls back to basic mode when the suffix is unknown", () => {
    expect(parseMockRealtimeToken("mock-abc-123:hologram")).toEqual({
      interviewId: "abc-123",
      mode: "basic",
    });
  });
});

describe("MockScriptedRealtimeClient", () => {
  beforeEach(() => {
    FakeEventSource.last = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens an EventSource with the parsed interview id and mode", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123:comprehensive" });

    expect(FakeEventSource.last).not.toBeNull();
    expect(FakeEventSource.last?.url).toContain("interview=abc-123");
    expect(FakeEventSource.last?.url).toContain("mode=comprehensive");
    expect(events.onStateChange).toHaveBeenCalledWith("connecting");
  });

  it("transitions to live when the `hello` event arrives", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", { interviewId: "abc-123" });

    expect(events.onStateChange).toHaveBeenCalledWith("live");
    expect(client.getStateForTest()).toBe("live");
  });

  it("dispatches conversation_state events through onConversationState", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", {});

    const speech: MockTimelineEvent = {
      delayMs: 0,
      kind: "conversation_state",
      type: "input_audio_buffer.speech_started",
    };
    FakeEventSource.last?.emit("timeline", speech);
    expect(events.onConversationState).toHaveBeenCalledWith("user_speaking");

    const committed: MockTimelineEvent = {
      delayMs: 0,
      kind: "conversation_state",
      type: "input_audio_buffer.committed",
    };
    FakeEventSource.last?.emit("timeline", committed);
    expect(events.onConversationState).toHaveBeenCalledWith("ai_thinking");

    const audio: MockTimelineEvent = {
      delayMs: 0,
      kind: "conversation_state",
      type: "response.audio.delta",
    };
    FakeEventSource.last?.emit("timeline", audio);
    expect(events.onConversationState).toHaveBeenCalledWith("ai_speaking");

    const done: MockTimelineEvent = {
      delayMs: 0,
      kind: "conversation_state",
      type: "response.done",
    };
    FakeEventSource.last?.emit("timeline", done);
    expect(events.onConversationState).toHaveBeenCalledWith("ai_done");
  });

  it("coalesces repeated conversation states (matches real client behaviour)", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", {});

    const audio: MockTimelineEvent = {
      delayMs: 0,
      kind: "conversation_state",
      type: "response.audio.delta",
    };
    FakeEventSource.last?.emit("timeline", audio);
    FakeEventSource.last?.emit("timeline", audio);
    FakeEventSource.last?.emit("timeline", audio);

    const speakingCalls = events.onConversationState.mock.calls.filter(
      (c) => c[0] === "ai_speaking",
    );
    expect(speakingCalls.length).toBe(1);
  });

  it("forwards tool_call events with the same shape as the real client", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", {});

    const call: MockTimelineEvent = {
      delayMs: 0,
      kind: "tool_call",
      name: "set_title",
      callId: "mock-call-1",
      arguments: { title: "Hello world" },
    };
    FakeEventSource.last?.emit("timeline", call);

    expect(events.onToolCall).toHaveBeenCalledWith({
      name: "set_title",
      arguments: { title: "Hello world" },
      callId: "mock-call-1",
    });
  });

  it("forwards transcript and usage events", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", {});

    const transcript: MockTimelineEvent = {
      delayMs: 0,
      kind: "transcript",
      role: "ai",
      text: "Hello there.",
    };
    FakeEventSource.last?.emit("timeline", transcript);
    expect(events.onTranscript).toHaveBeenCalledWith({
      role: "ai",
      text: "Hello there.",
    });

    const usage: MockTimelineEvent = {
      delayMs: 0,
      kind: "usage",
      input_tokens: 10,
      output_tokens: 20,
    };
    FakeEventSource.last?.emit("timeline", usage);
    expect(events.onUsage).toHaveBeenCalledWith({
      input_tokens: 10,
      output_tokens: 20,
    });
  });

  it("tears down on `done` and transitions to ended", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await client.connect({ ephemeralToken: "mock-abc-123" });
    FakeEventSource.last?.emit("hello", {});
    FakeEventSource.last?.emit("done", { ok: true });

    expect(events.onStateChange).toHaveBeenCalledWith("ended");
    expect(FakeEventSource.last?.closed).toBe(true);
  });

  it("transitions to error and throws when given a non-mock token", async () => {
    const events = buildEvents();
    const client = new MockScriptedRealtimeClient(events, {
      eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
    });

    await expect(
      client.connect({ ephemeralToken: "sk-real-key" }),
    ).rejects.toThrow(/mock-prefixed token/);
    expect(events.onStateChange).toHaveBeenCalledWith("error");
  });
});
