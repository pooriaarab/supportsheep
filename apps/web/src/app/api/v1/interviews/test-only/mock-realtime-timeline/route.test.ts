import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_LLM_PROVIDER = process.env.LLM_PROVIDER;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
  // process.env.NODE_ENV is non-configurable in some runtimes (vitest's node
  // env declares it as a read-only string property). Cast through unknown to
  // bypass the readonly narrowing — the underlying setter still accepts a
  // string assignment.
  (process.env as unknown as Record<string, string>).NODE_ENV = value;
}

beforeEach(() => {
  process.env.LLM_PROVIDER = "mock";
  setNodeEnv("development");
});

afterEach(() => {
  if (ORIGINAL_LLM_PROVIDER === undefined) {
    delete process.env.LLM_PROVIDER;
  } else {
    process.env.LLM_PROVIDER = ORIGINAL_LLM_PROVIDER;
  }
  setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
  vi.useRealTimers();
});

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function makeRequest(url: string, signal?: AbortSignal): Request {
  return new Request(url, { method: "GET", signal });
}

/**
 * Drain an SSE response by parsing `event:` / `data:` frames. Returns the
 * list of (event-name, data-object) pairs the server emitted before the
 * stream closed.
 */
async function drainSse(
  response: Response,
): Promise<{ event: string; data: Record<string, unknown> }[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  let buffer = "";
  const out: { event: string; data: Record<string, unknown> }[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.startsWith(":")) continue; // keepalive
      let eventName = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7);
        else if (line.startsWith("data: ")) dataLine = line.slice(6);
      }
      if (!dataLine) continue;
      try {
        out.push({ event: eventName, data: JSON.parse(dataLine) });
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}

describe("GET /api/v1/interviews/test-only/mock-realtime-timeline", () => {
  it("returns 404 when LLM_PROVIDER is not 'mock'", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest(
        "http://localhost/api/v1/interviews/test-only/mock-realtime-timeline?interview=abc",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when NODE_ENV is 'production' even with LLM_PROVIDER=mock", async () => {
    setNodeEnv("production");
    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest(
        "http://localhost/api/v1/interviews/test-only/mock-realtime-timeline?interview=abc",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when ?interview= is missing", async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      makeRequest(
        "http://localhost/api/v1/interviews/test-only/mock-realtime-timeline",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("opens an SSE stream and emits hello + at least one timeline event before abort", async () => {
    vi.useRealTimers();
    const { GET } = await loadRoute();
    const controller = new AbortController();
    const res = await GET(
      makeRequest(
        "http://localhost/api/v1/interviews/test-only/mock-realtime-timeline?interview=abc&mode=basic",
        controller.signal,
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    // Read enough bytes for the hello + the very first scripted event
    // (`delayMs: 0` — `input_audio_buffer.speech_started`), then abort.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no body reader");
    const decoder = new TextDecoder();
    let buffer = "";
    let helloSeen = false;
    let firstTimelineSeen = false;
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      if (buffer.includes("event: hello")) helloSeen = true;
      if (buffer.includes("event: timeline")) firstTimelineSeen = true;
      if (helloSeen && firstTimelineSeen) break;
    }
    controller.abort();
    try {
      await reader.cancel();
    } catch {
      // already aborted — fine
    }
    expect(helloSeen).toBe(true);
    expect(firstTimelineSeen).toBe(true);
  });

  it("emits the full ordered event sequence for the basic timeline", async () => {
    vi.useRealTimers();
    const { GET } = await loadRoute();
    // Stub setTimeout to fire ~immediately so the timeline plays out in
    // < 100ms — the route still goes through the full event loop and the
    // SSE framing pipeline, just without the human-paced delays.
    const realSetTimeout = global.setTimeout;
    global.setTimeout = ((cb: () => void, _delay?: number) =>
      realSetTimeout(cb, 0)) as unknown as typeof setTimeout;
    try {
      const res = await GET(
        makeRequest(
          "http://localhost/api/v1/interviews/test-only/mock-realtime-timeline?interview=abc&mode=basic",
        ),
      );
      const frames = await drainSse(res);

      expect(frames[0].event).toBe("hello");
      const helloData = frames[0].data;
      expect(helloData.mode).toBe("basic");
      expect(helloData.eventCount).toBeGreaterThan(0);

      const timelineFrames = frames.filter((f) => f.event === "timeline");
      expect(timelineFrames.length).toBeGreaterThan(0);

      // Tool calls must appear in order: set_title → insert_section → insert_paragraph (x2)
      const toolCallNames = timelineFrames
        .filter((f) => f.data.kind === "tool_call")
        .map((f) => f.data.name);
      expect(toolCallNames).toEqual([
        "set_title",
        "insert_section",
        "insert_paragraph",
        "insert_paragraph",
      ]);

      // Final frame is the `done` signal.
      expect(frames[frames.length - 1].event).toBe("done");
    } finally {
      global.setTimeout = realSetTimeout;
    }
  });
});
