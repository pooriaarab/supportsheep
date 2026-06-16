import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RealtimeClient } from "./realtime-client";
import { summarizeUserEdit } from "./user-edit-summary";

interface MockDataChannel {
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  readyState: string;
  onmessage: ((e: { data: string }) => void) | null;
  // The greeting-trigger fix wires `dc.onopen` to fire ONE `response.create`
  // so the AI greets first under server_vad. Tests need to simulate the
  // channel opening so we can assert the greeting fires exactly once and
  // no other client-fired response.create happens until a real narration
  // cue or user audio commit.
  onopen: (() => void) | null;
}

interface MockPeerConnection {
  addTrack: ReturnType<typeof vi.fn>;
  createDataChannel: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  connectionState: string;
}

describe("RealtimeClient", () => {
  let mockPC: MockPeerConnection;
  let mockDC: MockDataChannel;
  let mockMediaStream: unknown;
  let mockFetch: unknown;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock Data Channel
    mockDC = {
      close: vi.fn(),
      send: vi.fn(),
      readyState: "open",
      onmessage: null,
      onopen: null,
    };

    // Mock RTCPeerConnection
    mockPC = {
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => mockDC),
      createOffer: vi.fn().mockResolvedValue({ sdp: "mock-offer-sdp" }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      ontrack: null,
      onconnectionstatechange: null,
      connectionState: "new",
    };

    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPC) as unknown as typeof RTCPeerConnection;

    // Mock MediaStream and MediaStreamTrack
    mockMediaStream = {
      getTracks: vi.fn(() => [{ stop: vi.fn() }]),
      getAudioTracks: vi.fn(() => [{ enabled: true }]),
    };

    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
      },
      writable: true,
      configurable: true,
    });

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("mock-answer-sdp"),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connects successfully and creates peer connection & data channel", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123", baseUrl: "https://custom.api.com" });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(global.RTCPeerConnection).toHaveBeenCalled();
    expect(mockPC.createDataChannel).toHaveBeenCalledWith("oai-events");
    expect(mockPC.createOffer).toHaveBeenCalled();
    expect(mockPC.setLocalDescription).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      // GA endpoint — the legacy /realtime?model= query-param form
      // returns 400 on the production realtime API.
      "https://custom.api.com/realtime/calls",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/sdp",
        },
        body: "mock-offer-sdp",
      })
    );
    expect(mockPC.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "mock-answer-sdp" });
    expect(events.onStateChange).toHaveBeenCalledWith("connecting");
    expect(events.onStateChange).toHaveBeenCalledWith("live");
  });

  describe("greeting and response.create gating (W15.1 runaway-AI fix)", () => {
    // The session config now pins server_vad with create_response: true so
    // the server only auto-fires responses on committed audio. The client
    // still must fire exactly ONE `response.create` for the opening
    // greeting (via dc.onopen) and one per tool-result narration cue.
    // Anything beyond that on a session with no user audio is the bug.

    it("fires exactly one response.create greeting when the data channel opens", async () => {
      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      // No greeting yet — the data channel is still "connecting" from the
      // mock's perspective. We must trigger `onopen` to mirror real WebRTC.
      expect(mockDC.send).not.toHaveBeenCalled();

      mockDC.onopen?.();

      const responseCreates = mockDC.send.mock.calls
        .map((c) => JSON.parse(c[0] as string))
        .filter((m) => m.type === "response.create");
      expect(responseCreates).toHaveLength(1);
    });

    it("attaches non-empty instructions to the greeting response.create (W15.4 silent-greeting fix)", async () => {
      // The W15.4 regression was a `response.created → response.done` cycle
      // with no `response.audio.delta` between them — an empty greeting
      // turn that tripped `ai_greeting_timeout` at 5s. The fix forces the
      // greeting response to carry explicit `instructions` so the model
      // is told directly to emit its opening line as audio.
      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });
      mockDC.onopen?.();

      const responseCreates = mockDC.send.mock.calls
        .map((c) => JSON.parse(c[0] as string))
        .filter((m) => m.type === "response.create");
      expect(responseCreates).toHaveLength(1);
      const payload = responseCreates[0] as {
        type: string;
        response?: { instructions?: string };
      };
      expect(payload.response?.instructions).toBeTruthy();
      expect((payload.response?.instructions ?? "").length).toBeGreaterThan(0);
    });

    it("fires the greeting within 1s of dc.onopen so the orb does not stall on connecting", async () => {
      // Belt-and-suspenders for the same regression: dc.onopen must
      // synchronously dispatch the greeting, not defer via timers. A
      // queued microtask is fine; a setTimeout would delay the greeting
      // past the orb's `live` transition and visible UI cues.
      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      const start = Date.now();
      mockDC.onopen?.();
      const elapsed = Date.now() - start;

      const responseCreates = mockDC.send.mock.calls
        .map((c) => JSON.parse(c[0] as string))
        .filter((m) => m.type === "response.create");
      expect(responseCreates).toHaveLength(1);
      expect(elapsed).toBeLessThan(1_000);
    });

    it("emits a structured response_create_sent log on the greeting send", async () => {
      // The `interviews:realtime-client response_create_sent` INFO log is
      // the gcloud-searchable signal that every client-fired response was
      // actually attempted. Carries the trigger so greeting vs.
      // tool_result fires are distinguishable in logs.
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({
        ephemeralToken: "token-123",
        interviewId: "int-log-1",
      });
      mockDC.onopen?.();

      const sentLogs = infoSpy.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("interviews:realtime-client") &&
          c[0].includes("response_create_sent"),
      );
      expect(sentLogs).toHaveLength(1);
      expect(sentLogs[0][0]).toContain('"trigger":"greeting"');
      expect(sentLogs[0][0]).toContain('"interviewId":"int-log-1"');
      expect(sentLogs[0][0]).toContain('"instructionsLength"');

      infoSpy.mockRestore();
    });

    it("does NOT fire any additional response.create until a narration cue arrives", async () => {
      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onConversationState: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });
      mockDC.onopen?.();

      // Simulate the server going through its own response lifecycle —
      // server_vad with create_response:true means the model fires
      // `response.created` / `response.done` on its own, NOT the client.
      // The client must remain silent through this whole cycle.
      const sendsBefore = mockDC.send.mock.calls.length;
      mockDC.onmessage?.({
        data: JSON.stringify({ type: "response.created", response: { id: "resp_1" } }),
      });
      mockDC.onmessage?.({
        data: JSON.stringify({ type: "response.audio.delta", delta: "AAA" }),
      });
      mockDC.onmessage?.({
        data: JSON.stringify({ type: "response.done", response: {} }),
      });
      expect(mockDC.send.mock.calls.length).toBe(sendsBefore);
    });

    it("fires one response.create per narration cue (tool_result trigger)", async () => {
      const events = {
        onTranscript: vi.fn(),
        onToolCall: vi.fn(),
        onAudioLevel: vi.fn(),
        onStateChange: vi.fn(),
        onConversationState: vi.fn(),
        onUsage: vi.fn(),
      };

      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });
      mockDC.onopen?.();

      // Greeting fired once. Now a tool result lands and the hook calls
      // sendNarrationCue — that must produce exactly one more response.create.
      const greetingCount = mockDC.send.mock.calls
        .map((c) => JSON.parse(c[0] as string))
        .filter((m) => m.type === "response.create").length;
      expect(greetingCount).toBe(1);

      client.sendNarrationCue("Tool foo finished. Confirm in one short sentence.");

      const total = mockDC.send.mock.calls
        .map((c) => JSON.parse(c[0] as string))
        .filter((m) => m.type === "response.create").length;
      expect(total).toBe(2);
    });
  });

  it("disconnects cleanly closing PC, data channel, and stopping media tracks", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });
    client.disconnect();

    expect(mockDC.close).toHaveBeenCalled();
    expect(mockPC.close).toHaveBeenCalled();
    expect(events.onStateChange).toHaveBeenCalledWith("ended");
  });

  it("parses and propagates transcript and usage data channel messages", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    // Simulate AI transcript done message
    if (mockDC.onmessage) {
      mockDC.onmessage({ data: JSON.stringify({ type: "response.audio_transcript.done", transcript: "Hello AI text" }) });
    }
    expect(events.onTranscript).toHaveBeenCalledWith({ role: "ai", text: "Hello AI text" });

    // Simulate User transcript completed message
    if (mockDC.onmessage) {
      mockDC.onmessage({ data: JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", transcript: "Hello User text" }) });
    }
    expect(events.onTranscript).toHaveBeenCalledWith({ role: "user", text: "Hello User text" });

    // Simulate Tool call message
    if (mockDC.onmessage) {
      mockDC.onmessage({
        data: JSON.stringify({
          type: "response.function_call_arguments.done",
          name: "test_tool",
          arguments: '{"key": "value"}',
        }),
      });
    }
    expect(events.onToolCall).toHaveBeenCalledWith({ name: "test_tool", arguments: { key: "value" } });

    // Simulate response.done with usage
    if (mockDC.onmessage) {
      mockDC.onmessage({
        data: JSON.stringify({
          type: "response.done",
          response: {
            usage: { input_tokens: 10, output_tokens: 20 },
          },
        }),
      });
    }
    expect(events.onUsage).toHaveBeenCalledWith({ input_tokens: 10, output_tokens: 20 });
  });

  it("reconnects on disconnection up to MAX_RECONNECT_ATTEMPTS", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    // Reset calls to onStateChange
    events.onStateChange.mockClear();

    // Set connectionState and call onconnectionstatechange
    mockPC.connectionState = "failed";
    if (mockPC.onconnectionstatechange) {
      mockPC.onconnectionstatechange();
    }

    expect(events.onStateChange).toHaveBeenCalledWith("reconnecting");

    // Reconnection is scheduled with RECONNECT_BACKOFF_MS[0] = 1000ms. Fast forward timers.
    await vi.advanceTimersByTimeAsync(1_000);

    // After 1s, connect should be called again, resetting state to live
    expect(events.onStateChange).toHaveBeenCalledWith("live");
  });

  it("emits conversation-state transitions for turn-level data-channel events", async () => {
    // W9.2 regression: the orb was stuck on `listening` because the data
    // channel never surfaced turn-level events as `onConversationState`
    // callbacks. Without these mappings the orb has no signal to flip off
    // the ambient "listening" pulse when the AI is speaking or thinking.
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    // User starts talking → user_speaking
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "input_audio_buffer.speech_started" }),
    });
    expect(events.onConversationState).toHaveBeenCalledWith("user_speaking");

    // Mic commits → ai_thinking (waiting for the response to begin)
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "input_audio_buffer.committed" }),
    });
    expect(events.onConversationState).toHaveBeenCalledWith("ai_thinking");

    // Audio starts streaming → ai_speaking
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.audio.delta", delta: "AAA" }),
    });
    expect(events.onConversationState).toHaveBeenCalledWith("ai_speaking");

    // Repeats during a single AI turn must coalesce — `ai_speaking` fires
    // exactly once even though the realtime API streams many audio deltas.
    const speakingBefore = events.onConversationState.mock.calls.filter(
      (c) => c[0] === "ai_speaking",
    ).length;
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.audio.delta", delta: "BBB" }),
    });
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.output_audio.delta", delta: "CCC" }),
    });
    const speakingAfter = events.onConversationState.mock.calls.filter(
      (c) => c[0] === "ai_speaking",
    ).length;
    expect(speakingAfter).toBe(speakingBefore);

    // Response done → ai_done
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.done", response: {} }),
    });
    expect(events.onConversationState).toHaveBeenCalledWith("ai_done");
  });

  it("emits a single first_ai_turn boot log on the first AI audio delta", async () => {
    // Greeting visibility regression guard: ops needs a one-shot
    // `interviews:realtime-client first_ai_turn` INFO log to verify the
    // AI greeted the user at session start (system-prompt directive added
    // by PR #196 and reinforced by PR #257). Without this log a missing
    // greeting is invisible until a human notices in QA.
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({
      ephemeralToken: "token-123",
      interviewId: "int-greet-1",
    });

    // First audio delta — the actual byte of the greeting.
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.audio.delta", delta: "AAA" }),
    });

    // Second audio delta from the same turn — must NOT re-fire the log,
    // the directive only needs one observation per session.
    mockDC.onmessage?.({
      data: JSON.stringify({ type: "response.audio.delta", delta: "BBB" }),
    });

    const firstTurnLogs = infoSpy.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("interviews:realtime-client") &&
        c[0].includes("first_ai_turn"),
    );
    expect(firstTurnLogs).toHaveLength(1);
    // The structured fields ride in the trailing JSON blob so a single
    // gcloud query can extract them.
    expect(firstTurnLogs[0][0]).toContain('"interviewId":"int-greet-1"');
    expect(firstTurnLogs[0][0]).toContain('"msFromConnect"');
    expect(firstTurnLogs[0][0]).toContain('"source":"audio_delta"');

    infoSpy.mockRestore();
  });

  it("falls back to first_ai_turn on transcript_done when no audio delta arrived first", async () => {
    // Tool-only turns can finalise the transcript without ever emitting a
    // `response.audio.delta`. The boot log must still fire so a
    // greeting-via-tool-only path is observable.
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({
      ephemeralToken: "token-123",
      interviewId: "int-greet-2",
    });

    mockDC.onmessage?.({
      data: JSON.stringify({
        type: "response.audio_transcript.done",
        transcript: "I'm capturing your story as you talk. Let's go.",
      }),
    });

    const firstTurnLogs = infoSpy.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("interviews:realtime-client") &&
        c[0].includes("first_ai_turn"),
    );
    expect(firstTurnLogs).toHaveLength(1);
    expect(firstTurnLogs[0][0]).toContain('"source":"transcript_done"');

    infoSpy.mockRestore();
  });

  it("emits onAiChatTurn with the final transcript text when an AI turn completes", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onAiChatTurn: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    mockDC.onmessage?.({
      data: JSON.stringify({
        type: "response.audio_transcript.done",
        transcript: "I am erroring and here's why",
      }),
    });

    expect(events.onAiChatTurn).toHaveBeenCalledTimes(1);
    expect(events.onAiChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "I am erroring and here's why",
        timestamp: expect.any(Number),
      }),
    );
    // The transcript callback must still fire so the Firestore persistence
    // path (event buffer → /events POST) is unchanged.
    expect(events.onTranscript).toHaveBeenCalledWith({
      role: "ai",
      text: "I am erroring and here's why",
    });
  });

  it("does NOT emit onAiChatTurn for an empty transcript so the log never renders blank rows", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onAiChatTurn: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    mockDC.onmessage?.({
      data: JSON.stringify({
        type: "response.audio_transcript.done",
        transcript: "   ",
      }),
    });

    expect(events.onAiChatTurn).not.toHaveBeenCalled();
  });

  it("forwards the upstream call_id on function-call tool invocations", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    mockDC.onmessage?.({
      data: JSON.stringify({
        type: "response.function_call_arguments.done",
        name: "insert_section",
        arguments: '{"heading":"Intro"}',
        call_id: "abc-123",
      }),
    });

    expect(events.onToolCall).toHaveBeenCalledWith({
      name: "insert_section",
      arguments: { heading: "Intro" },
      callId: "abc-123",
    });
  });

  it("routes mock-prefixed ephemeral tokens to MockScriptedRealtimeClient and skips WebRTC", async () => {
    // The dev interview harness relies on this branch — a `mock-<id>` token
    // must NOT touch getUserMedia, RTCPeerConnection, or `api.openai.com`.
    // We assert via the bridge that no WebRTC plumbing was constructed and
    // an SSE EventSource was opened against the mock timeline route.
    const getUserMediaSpy = vi.spyOn(
      global.navigator.mediaDevices,
      "getUserMedia",
    );
    const fetchSpy = vi.spyOn(global, "fetch");

    class CapturingEventSource {
      url: string;
      addEventListener = vi.fn();
      close = vi.fn();
      onerror: ((ev: unknown) => void) | null = null;
      constructor(url: string) {
        this.url = url;
        CapturingEventSource.last = this;
      }
      static last: CapturingEventSource | null = null;
    }
    const originalEventSource = (
      global as unknown as { EventSource?: typeof EventSource }
    ).EventSource;
    (global as unknown as { EventSource: unknown }).EventSource =
      CapturingEventSource as unknown as typeof EventSource;

    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    };

    try {
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "mock-abc-123:basic" });

      expect(CapturingEventSource.last).not.toBeNull();
      expect(CapturingEventSource.last?.url).toContain(
        "/api/v1/interviews/test-only/mock-realtime-timeline",
      );
      expect(CapturingEventSource.last?.url).toContain("interview=abc-123");
      expect(CapturingEventSource.last?.url).toContain("mode=basic");

      // Critically: no WebRTC plumbing and no OpenAI SDP request.
      expect(getUserMediaSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(global.RTCPeerConnection).not.toHaveBeenCalled();
    } finally {
      if (originalEventSource === undefined) {
        delete (global as unknown as { EventSource?: unknown }).EventSource;
      } else {
        (global as unknown as { EventSource: typeof EventSource }).EventSource =
          originalEventSource;
      }
    }
  });

  describe("sendNarrationCue", () => {
    const baseEvents = () => ({
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onConversationState: vi.fn(),
      onUsage: vi.fn(),
    });

    it("pushes a user-role marker-prefixed message + response.create over the data channel when the session is live", async () => {
      // The cue rides as `role: "user"` (not "system") so the Realtime API
      // retains it in conversation history — system-role items are pruned
      // after the next response, which broke the W23.E walkthrough where
      // the user typed text and the AI couldn't recall it two turns later.
      // The system prompt teaches the model to treat the
      // `[system narration cue]` marker prefix as out-of-band guidance.
      const events = baseEvents();
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      client.sendNarrationCue("[system narration cue] The tool set_title finished. Confirm in one short sentence.");

      // First call: conversation.item.create with a user-role message.
      const sends = mockDC.send.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(sends.length).toBe(2);
      expect(sends[0]).toMatchObject({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "[system narration cue] The tool set_title finished. Confirm in one short sentence.",
            },
          ],
        },
      });
      // Second call: response.create to trigger the model to speak.
      expect(sends[1]).toMatchObject({ type: "response.create" });
    });

    it("delivers a user_edit cue verbatim so the model can quote it back when asked 'what did I type?'", async () => {
      // W23.E regression guard: the realtime client must forward the full
      // narration-cue text (including the quoted user content) into the
      // persistent conversation history. Without this, the AI loses the
      // user's typed text the moment its own next turn ends — which is
      // exactly the production walkthrough that motivated this fix.
      const events = baseEvents();
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      const cueBody =
        '[system narration cue] The user just added new text to the canvas: "hello world" Acknowledge their edit naturally in one short sentence as a human collaborator would (no tool names, no jargon) and continue the interview. If the edit suggests a new direction, follow it.';
      client.sendNarrationCue(cueBody, { kind: "user_edit" });

      const sends = mockDC.send.mock.calls.map((c) => JSON.parse(c[0] as string));
      const conversationItems = sends.filter(
        (m) => m.type === "conversation.item.create",
      );
      expect(conversationItems).toHaveLength(1);
      const item = conversationItems[0] as {
        item: {
          role: string;
          content: ReadonlyArray<{ type: string; text: string }>;
        };
      };
      // Persistent in conversation history → role must be "user".
      expect(item.item.role).toBe("user");
      // The verbatim user text must be inside the cue body that landed on
      // the wire, otherwise the AI has nothing to quote back later.
      expect(item.item.content[0]?.text).toContain('"hello world"');
      expect(item.item.content[0]?.text).toBe(cueBody);
      // And a response.create must follow so the model actually speaks
      // an acknowledgement rather than staying silent.
      const responseCreates = sends.filter((m) => m.type === "response.create");
      expect(responseCreates).toHaveLength(1);
    });

    it("is a no-op when the data channel is not open so the cue does not throw", async () => {
      const events = baseEvents();
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      mockDC.readyState = "closing";
      client.sendNarrationCue("dropped");

      // No send calls because the data channel is not open.
      expect(mockDC.send).not.toHaveBeenCalled();
    });

    it("trims the cue and skips empty narration text", async () => {
      const events = baseEvents();
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });

      client.sendNarrationCue("   ");
      expect(mockDC.send).not.toHaveBeenCalled();
    });

    it("composes summarizeUserEdit + sendNarrationCue so 'hello world' lands verbatim on the data channel (W23.E end-to-end)", async () => {
      // W23.E walkthrough: user typed text on the canvas, asked "what
      // did I just type?" and the AI said "your latest text didn't
      // come." Root cause was `role: "system"` items being pruned from
      // conversation history. This test composes the real summarizer
      // with the real client to assert the exact production path
      // delivers a user-role conversation item whose body quotes the
      // user's verbatim text — so a regression on either layer is
      // caught at the same seam the production walkthrough exercises.
      const events = baseEvents();
      const client = new RealtimeClient(events);
      await client.connect({ ephemeralToken: "token-123" });
      mockDC.send.mockClear();

      // The canvas was empty, then the user typed "hello world" — the
      // exact wording from the production walkthrough.
      const cue = summarizeUserEdit("", "hello world");
      expect(cue).not.toBeNull();
      expect(cue?.cueText).toContain("hello world");

      client.sendNarrationCue(cue!.cueText, { kind: "user_edit" });

      const sends = mockDC.send.mock.calls.map((c) => JSON.parse(c[0] as string));
      const items = sends.filter((m) => m.type === "conversation.item.create");
      expect(items).toHaveLength(1);
      const item = items[0] as {
        item: {
          role: string;
          content: ReadonlyArray<{ type: string; text: string }>;
        };
      };
      // Persistent in conversation history → must be user-role, not
      // system-role. This is the fix that closes the W23.E bug.
      expect(item.item.role).toBe("user");
      // Verbatim user text must be inside the cue body that landed on
      // the wire — otherwise the AI has no record to quote back later.
      expect(item.item.content[0]?.text).toContain("hello world");
      // And a response.create must follow so the model speaks an
      // acknowledgement instead of staying silent.
      expect(sends.some((m) => m.type === "response.create")).toBe(true);
    });

    it("is a no-op when routed to the mock scripted client so dev harness narration is unaffected", async () => {
      const events = baseEvents();
      const client = new RealtimeClient(events);
      // Mock-prefixed token routes through MockScriptedRealtimeClient, which
      // owns its own scripted timeline — narration cues from the SSE pipeline
      // would double up.
      const fetchSpy = vi.spyOn(global, "fetch");
      class CapturingEventSource {
        url: string;
        addEventListener = vi.fn();
        close = vi.fn();
        onerror: ((ev: unknown) => void) | null = null;
        constructor(url: string) {
          this.url = url;
        }
      }
      (global as unknown as { EventSource: unknown }).EventSource =
        CapturingEventSource as unknown as typeof EventSource;
      try {
        await client.connect({ ephemeralToken: "mock-abc-123:basic" });
        client.sendNarrationCue("should be dropped");
        // No real fetch, no real send (the mock scripted client owns its own
        // transport).
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockDC.send).not.toHaveBeenCalled();
      } finally {
        delete (global as unknown as { EventSource?: unknown }).EventSource;
      }
    });
  });

  it("gives up after 3 reconnect attempts and surfaces error state", async () => {
    const events = {
      onTranscript: vi.fn(),
      onToolCall: vi.fn(),
      onAudioLevel: vi.fn(),
      onStateChange: vi.fn(),
      onUsage: vi.fn(),
    };

    const client = new RealtimeClient(events);
    await client.connect({ ephemeralToken: "token-123" });

    // After the initial successful connect, swap fetch to a failing impl so
    // every reconnect attempt throws inside connect(). The handler should
    // re-enter handleDisconnect, bump the counter, and eventually give up
    // with state="error" — never loop past MAX_RECONNECT_ATTEMPTS=3.
    const failingFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: vi.fn().mockResolvedValue("bad gateway"),
      headers: { get: () => null },
    });
    global.fetch = failingFetch as unknown as typeof fetch;

    events.onStateChange.mockClear();

    // Trigger the initial disconnect — schedules attempt 1 (1000ms backoff).
    mockPC.connectionState = "failed";
    mockPC.onconnectionstatechange?.();

    // Walk past each backoff slot. Failing fetch throws inside connect, which
    // re-enters handleDisconnect — advance well past the cumulative worst
    // case (1+3+10s) so all 3 attempts have been consumed.
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(1_000);

    // After 3 failed attempts the client must land on "error".
    expect(events.onStateChange).toHaveBeenCalledWith("error");

    // No further reconnect transitions may be scheduled after the cap.
    events.onStateChange.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    const postErrorReconnects = events.onStateChange.mock.calls.filter(
      (c) => c[0] === "reconnecting",
    );
    expect(postErrorReconnects).toHaveLength(0);
  });
});
