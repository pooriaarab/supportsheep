import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeServerAuthoritativeUsage, __test_constants__ } from "./server-side-usage";

// Mock the events repository (D1 path)
const mockListAllEvents = vi.hoisted(() => vi.fn());

vi.mock("./events-repository", () => ({
  listAllEvents: mockListAllEvents,
}));

function makeEvent(kind: string, payload: unknown, ts = "2026-05-01T00:00:00.000Z") {
  return {
    id: `ev-${Math.random()}`,
    blogId: "default",
    interviewId: "test-id",
    kind,
    ts,
    createdAt: Date.now(),
    payload,
  };
}

describe("computeServerAuthoritativeUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeros for an empty events collection", async () => {
    mockListAllEvents.mockResolvedValue([]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result).toEqual({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });
  });

  it("counts transcript_user text as realtime input tokens", async () => {
    // 35 chars -> ceil(35 / 3.5) = 10 tokens, plus 50 per-turn overhead
    const text = "x".repeat(35);
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_user", { text }),
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result.realtime.input).toBe(10 + __test_constants__.PER_TURN_OVERHEAD_TOKENS);
    expect(result.realtime.output).toBe(0);
  });

  it("counts transcript_ai text as realtime output tokens", async () => {
    const text = "y".repeat(70); // 70/3.5 = 20 tokens
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_ai", { text }),
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result.realtime.output).toBe(20);
    // One turn -> one overhead allocation on the input side
    expect(result.realtime.input).toBe(__test_constants__.PER_TURN_OVERHEAD_TOKENS);
  });

  it("IGNORES client-supplied usage payloads — counts only from text (F-003 regression)", async () => {
    // The malicious-client scenario: a guest sends usage={input_tokens:0,
    // output_tokens:0} but the actual transcript text reveals a long
    // conversation. The server-authoritative count must ignore the usage
    // field entirely.
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_user", {
        text: "x".repeat(3500), // 1000 tokens at 1/3.5
        usage: { input_tokens: 0, output_tokens: 0 }, // <-- malicious
      }),
      makeEvent("transcript_ai", {
        text: "y".repeat(7000), // 2000 tokens
        usage: { input_tokens: 0, output_tokens: 0 }, // <-- malicious
      }),
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result.realtime.input).toBeGreaterThanOrEqual(1000);
    expect(result.realtime.output).toBeGreaterThanOrEqual(2000);
  });

  it("clamps oversized per-event text to the hard cap", async () => {
    // 1 MB of text — without the clamp this would be ~285K tokens.
    const text = "z".repeat(1_000_000);
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_user", { text }),
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    const cap = __test_constants__.PER_EVENT_TEXT_CAP_CHARS;
    const expected = Math.ceil(cap / 3.5) + __test_constants__.PER_TURN_OVERHEAD_TOKENS;
    expect(result.realtime.input).toBe(expected);
  });

  it("skips events with no text payload", async () => {
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_user", undefined), // no payload
      makeEvent("transcript_ai", {}), // no text
      makeEvent("transcript_user", { text: 42 }), // wrong type
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result.realtime).toEqual({ input: 0, output: 0 });
  });

  it("returns writer zeros (writer-side usage tracking is out of scope for the F-003 fix)", async () => {
    mockListAllEvents.mockResolvedValue([
      makeEvent("transcript_user", { text: "hello" }),
    ]);

    const result = await computeServerAuthoritativeUsage("default", "test-id");
    expect(result.writer).toEqual({ input: 0, cachedInput: 0, output: 0 });
  });

  it("scopes the D1 query to only the transcript kinds (no transcript_ai usage hijacking)", async () => {
    mockListAllEvents.mockResolvedValue([]);
    await computeServerAuthoritativeUsage("default", "test-id");

    expect(mockListAllEvents).toHaveBeenCalledWith(
      "default",
      "test-id",
      { kinds: ["transcript_user", "transcript_ai"] },
    );
  });
});
