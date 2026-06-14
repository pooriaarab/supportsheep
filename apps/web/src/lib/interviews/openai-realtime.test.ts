import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderApiKey: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: mocks.getProviderApiKey,
}));

import { mintRealtimeSession, CANVAS_TOOLS } from "./openai-realtime";

const ENDPOINT = "https://api.openai.com/v1/realtime/client_secrets";

describe("openai-realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if the OpenAI key is not configured in Firestore", async () => {
    mocks.getProviderApiKey.mockRejectedValueOnce(
      new Error(
        "OpenAI API key not configured. Add it in Settings > AI Providers.",
      ),
    );

    await expect(
      mintRealtimeSession({
        voice: "alloy",
        instructions: "Test instructions",
        tools: [...CANVAS_TOOLS],
      }),
    ).rejects.toThrow("OpenAI API key not configured");
  });

  it("posts the new nested-session body to /v1/realtime/client_secrets", async () => {
    mocks.getProviderApiKey.mockResolvedValueOnce("test-sk-key");

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => "req_abc" },
      json: async () => ({
        value: "ek_session_12345",
        expires_at: 1234567890,
        id: "rt_sess_abc",
      }),
    } as unknown as Response);

    const result = await mintRealtimeSession({
      voice: "alloy",
      instructions: "Test instructions",
      tools: [...CANVAS_TOOLS],
    });

    expect(result).toEqual({
      client_secret: { value: "ek_session_12345", expires_at: 1234567890 },
      id: "rt_sess_abc",
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.headers).toEqual({
      Authorization: "Bearer test-sk-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(init.body as string);
    expect(body.session.model).toBe("gpt-realtime-2");
    expect(body.session.audio.output.voice).toBe("alloy");
    // Format is an `{ type, rate }` object — verified live against the
    // GA /v1/realtime/client_secrets endpoint. A string ("pcm16") is
    // rejected with 400 "Invalid type for 'session.audio.input.format':
    // expected an object, but got a string instead." Keep the shape
    // asserted here so a future swap doesn't reintroduce the prod 502.
    expect(body.session.audio.input.format).toEqual({
      type: "audio/pcm",
      rate: 24000,
    });
    expect(body.session.audio.output.format).toEqual({
      type: "audio/pcm",
      rate: 24000,
    });
    expect(body.session.output_modalities).toEqual(["audio"]);
    expect(body.session.instructions).toBe("Test instructions");
    // Force tool use — without `tool_choice: "auto"` the realtime model
    // defaults to audio-only turns and never invokes the registered
    // canvas tools, so the live canvas never updates.
    expect(body.session.tool_choice).toBe("auto");
    // Transcription is opt-in via `language` — when absent, neither
    // location (correct nested or legacy session-root) should appear.
    expect(body.session.audio.input.transcription).toBeUndefined();
    expect(body.session.input_audio_transcription).toBeUndefined();
    // Server-side VAD must be pinned with documented defaults. Without
    // this the GA `gpt-realtime` model ran away during W15.1 walkthrough,
    // fabricating user turns and authoring an entire article with no mic
    // input. `create_response: true` is the critical bit: it gates AI
    // responses on a committed audio buffer (`input_audio_buffer.committed`),
    // so the model can no longer fire `response.create` on its own off the
    // back of `response.done`.
    expect(body.session.audio.input.turn_detection).toEqual({
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 800,
      create_response: true,
      interrupt_response: true,
    });
  });

  it("nests transcription under audio.input when language is provided", async () => {
    mocks.getProviderApiKey.mockResolvedValueOnce("test-sk-key");

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => "req_lang" },
      json: async () => ({
        value: "ek_lang",
        expires_at: 0,
        id: "rt_lang",
      }),
    } as unknown as Response);

    await mintRealtimeSession({
      voice: "alloy",
      instructions: "Test",
      tools: [...CANVAS_TOOLS],
      language: "es",
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    // The GA endpoint accepts transcription nested under audio.input —
    // session.input_audio_transcription is rejected with 400 "Unknown
    // parameter". Verified live; do not move without re-probing.
    expect(body.session.audio.input.transcription).toEqual({
      model: "whisper-1",
      language: "es",
    });
    expect(body.session.input_audio_transcription).toBeUndefined();
  });

  it("falls back to legacy nested client_secret shape if returned", async () => {
    mocks.getProviderApiKey.mockResolvedValueOnce("test-sk-key");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        client_secret: { value: "ek_legacy_shape", expires_at: 999 },
        id: "rt_sess_legacy",
      }),
    } as unknown as Response);

    const result = await mintRealtimeSession({
      voice: "alloy",
      instructions: "Test",
      tools: [...CANVAS_TOOLS],
    });

    expect(result.client_secret.value).toBe("ek_legacy_shape");
    expect(result.id).toBe("rt_sess_legacy");
  });

  it("throws on non-2xx response with status + body in message", async () => {
    mocks.getProviderApiKey.mockResolvedValueOnce("test-sk-key");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: async () => "Invalid model choice",
    } as unknown as Response);

    await expect(
      mintRealtimeSession({
        voice: "alloy",
        instructions: "Test instructions",
        tools: [...CANVAS_TOOLS],
      }),
    ).rejects.toThrow(
      "OpenAI realtime mint failed (400): Invalid model choice",
    );
  });

  it("throws if the success response has no client secret value", async () => {
    mocks.getProviderApiKey.mockResolvedValueOnce("test-sk-key");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ id: "rt_sess_no_secret" }),
    } as unknown as Response);

    await expect(
      mintRealtimeSession({
        voice: "alloy",
        instructions: "Test",
        tools: [...CANVAS_TOOLS],
      }),
    ).rejects.toThrow(/missing client secret value/);
  });
});
