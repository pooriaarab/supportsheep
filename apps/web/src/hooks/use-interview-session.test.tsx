import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useInterviewSession,
  applyDiff,
  parseToolCallSseEvent,
  parseToolFailedSseEvent,
  toolCallEntryFromRealtime,
  shouldForwardNarrationCue,
  NARRATION_CUE_DEDUP_WINDOW_MS,
  type CanvasState,
  type CanvasImage,
} from "./use-interview-session";

interface CustomGlobal {
  lastRealtimeClientEvents?: Record<string, (...args: unknown[]) => unknown>;
  lastEventSourceInstance?: { url: string; addEventListener: ReturnType<typeof vi.fn>; listeners?: Record<string, (ev: unknown) => unknown> };
  lastMountCleanup?: () => void;
  lastMockRealtimeClient?: {
    sendNarrationCue: ReturnType<typeof vi.fn>;
  };
}

const customGlobal = global as unknown as CustomGlobal;

const { mockLogInfo, mockLogDebug, mockLogWarn, mockLogError } = vi.hoisted(() => ({
  mockLogInfo: vi.fn(),
  mockLogDebug: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: mockLogDebug,
    info: mockLogInfo,
    warn: mockLogWarn,
    error: mockLogError,
  }),
}));

// Mock RealtimeClient
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn();
const mockMute = vi.fn();
const mockForceEnd = vi.fn();
const mockSendNarrationCue = vi.fn();

vi.mock("@/lib/interviews/realtime-client", () => {
  return {
    RealtimeClient: vi.fn().mockImplementation((events) => {
      customGlobal.lastRealtimeClientEvents = events as Record<string, (...args: unknown[]) => unknown>;
      const instance = {
        connect: mockConnect,
        disconnect: mockDisconnect,
        mute: mockMute,
        forceEnd: mockForceEnd,
        sendNarrationCue: mockSendNarrationCue,
      };
      customGlobal.lastMockRealtimeClient = instance as unknown as typeof customGlobal.lastMockRealtimeClient;
      return instance;
    }),
  };
});

// Mock EventSource. The real DOM EventSource auto-reconnects on its own; we
// need the mock to expose the same surface (readyState, close, onerror) so
// the hook's managed reconnect logic can drive it deterministically.
const mockClose = vi.fn();
const eventSourceInstances: MockEventSource[] = [];
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  listeners: Record<string, (ev: unknown) => unknown> = {};
  addEventListener = vi.fn((evt: string, cb: (ev: unknown) => unknown) => {
    this.listeners[evt] = cb;
  });
  onerror: ((ev: Event) => void) | null = null;
  close = mockClose;
  readyState: number = 0;
  constructor(public url: string) {
    customGlobal.lastEventSourceInstance = this as unknown as typeof customGlobal.lastEventSourceInstance;
    eventSourceInstances.push(this);
  }
}
global.EventSource = MockEventSource as unknown as typeof EventSource;

// Mock useMountEffect so we can trigger cleanup manually
vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn((effect) => {
    const cleanup = effect();
    if (cleanup) {
      customGlobal.lastMountCleanup = cleanup;
    }
  }),
}));

interface WrapperProps {
  input: {
    interviewId: string;
    interviewToken: string;
    ephemeralOpenAiToken: string;
    onEndRequested?: () => void;
  };
  onRef: (ref: unknown) => void;
}

function TestWrapper({ input, onRef }: WrapperProps) {
  const result = useInterviewSession(input);
  onRef(result as unknown);
  return null;
}

/**
 * Default fetch mock — returns the response shape each interview endpoint
 * expects. The hook now hits multiple endpoints on mount (session-lock,
 * canvas-snapshot, events POST flush), and each one needs a sensible response
 * for the gated-startup logic to run through to the realtime connect.
 */
function setupDefaultFetchMock(): ReturnType<typeof vi.fn> {
  return vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/session-lock") && init?.method !== "POST" && init?.method !== "DELETE") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ holder: null, lastBeatAt: null, stale: false }),
      });
    }
    if (u.includes("/session-lock") && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "acquired" }),
      });
    }
    if (u.includes("/session-lock") && init?.method === "DELETE") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ released: true }),
      });
    }
    if (u.includes("/canvas-snapshot")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ canvas: null, snapshotAt: null }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

/** Flush queued microtasks so deferred session-startup runs before assertions. */
async function flushMicrotasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe("useInterviewSession", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = setupDefaultFetchMock();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockSendNarrationCue.mockClear();
    mockClose.mockClear();
    mockLogInfo.mockClear();
    mockLogDebug.mockClear();
    mockLogWarn.mockClear();
    mockLogError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete customGlobal.lastRealtimeClientEvents;
    delete customGlobal.lastEventSourceInstance;
    delete customGlobal.lastMountCleanup;
    eventSourceInstances.length = 0;
  });

  it("sets up RealtimeClient, EventSource, and flush intervals on mount", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    let session: { sendMessage?: (text: string) => void } | null = null;
    renderToStaticMarkup(<TestWrapper input={input} onRef={(ref) => { session = ref as unknown as { sendMessage?: (text: string) => void }; }} />);

    // Session startup is gated by an async session-lock check. Flush queued
    // microtasks so the lock GET + acquire-POST resolve and startSession runs.
    await flushMicrotasks();

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeralToken: "token-oai" }),
    );
    expect(customGlobal.lastEventSourceInstance).toBeDefined();
    // F-006: SSE token must not appear in the URL query string. The token
    // is now delivered via the `interview_token_<id>` HttpOnly cookie set
    // by /consent — EventSource sends it automatically because it's
    // same-origin.
    expect(customGlobal.lastEventSourceInstance?.url).toBe(
      "/api/v1/interviews/int-123/stream",
    );
    expect(customGlobal.lastEventSourceInstance?.url).not.toContain("token=");
    expect(customGlobal.lastEventSourceInstance?.addEventListener).toHaveBeenCalledWith("writer_diff", expect.any(Function));
    expect(session).not.toBeNull();
  });

  it("buffers user transcripts, AI transcripts, tool calls, and periodically flushes them", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();

    // Trigger user transcript
    clientEvents?.onTranscript({ role: "user", text: "Hello AI" });
    // Trigger tool call
    clientEvents?.onToolCall({ name: "add_heading", arguments: { text: "Heading 1" } });

    // Advance timer by 1s to trigger periodic flush
    await vi.advanceTimersByTimeAsync(1000);

    const eventsCall = mockFetch.mock.calls.find(
      (c) => String(c[0]).includes("/events") && c[1]?.method === "POST",
    );
    expect(eventsCall).toBeDefined();
    expect(eventsCall![1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(String(eventsCall![1].body)).toContain("transcript_user");

    const fetchBody = JSON.parse(String(eventsCall![1].body)) as Array<{ kind: string; payload: Record<string, unknown> }>;
    expect(fetchBody).toHaveLength(2);
    expect(fetchBody[0].kind).toBe("transcript_user");
    expect(fetchBody[0].payload).toEqual({ text: "Hello AI" });
    expect(fetchBody[1].kind).toBe("tool_call");
    expect(fetchBody[1].payload).toEqual({ name: "add_heading", arguments: { text: "Heading 1" } });
  });

  it("handles sendMessage by immediately buffering and flushing event", () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    let session: { sendMessage?: (text: string) => void } = {};
    renderToStaticMarkup(<TestWrapper input={input} onRef={(ref) => { session = ref as unknown as { sendMessage?: (text: string) => void }; }} />);
    session.sendMessage?.("User message input");

    const eventsCall = mockFetch.mock.calls.find(
      (c) => String(c[0]).includes("/events") && c[1]?.method === "POST",
    );
    expect(eventsCall).toBeDefined();
    expect(String(eventsCall![1].body)).toContain("chat_input");
  });

  it("runs cleanup on unmount: stops timers, closes SSE, disconnects client, and final flushes", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();
    const clientEvents = customGlobal.lastRealtimeClientEvents;
    clientEvents?.onTranscript({ role: "user", text: "Leaving soon" });

    const cleanup = customGlobal.lastMountCleanup;
    expect(cleanup).toBeDefined();

    cleanup?.();

    expect(mockClose).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
    // Final flush of remaining events
    const finalFlushCall = mockFetch.mock.calls.find(
      (c) =>
        String(c[0]).includes("/events") &&
        c[1]?.method === "POST" &&
        String(c[1].body).includes("Leaving soon"),
    );
    expect(finalFlushCall).toBeDefined();
  });

  it("on SSE error, closes the current EventSource and reconnects with exponential backoff", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // First EventSource is open
    expect(eventSourceInstances).toHaveLength(1);
    const first = eventSourceInstances[0];
    expect(first.onerror).toBeTypeOf("function");
    expect(mockClose).not.toHaveBeenCalled();

    // Simulate the browser firing an `error` event on the open stream.
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    // The hook should close that EventSource immediately, *not* let the
    // browser's native auto-reconnect take over.
    expect(mockClose).toHaveBeenCalledTimes(1);

    // It should NOT immediately open a new EventSource — backoff must apply.
    expect(eventSourceInstances).toHaveLength(1);

    // After the first backoff slot (250ms + up to 250ms jitter) a new
    // connection must be opened. Advance well past the worst-case delay.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(eventSourceInstances).toHaveLength(2);

    // The second instance must register the same listeners as the first,
    // so writer_diff / canvas_edit / hello continue to flow.
    expect(eventSourceInstances[1].addEventListener).toHaveBeenCalledWith("writer_diff", expect.any(Function));
    expect(eventSourceInstances[1].addEventListener).toHaveBeenCalledWith("canvas_edit", expect.any(Function));
    expect(eventSourceInstances[1].addEventListener).toHaveBeenCalledWith("hello", expect.any(Function));
  });

  it("stops reconnecting and surfaces an error after SSE max retries", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // Drive 9 consecutive errors (max is 8) and the hook must stop opening
    // new EventSources after the cap.
    for (let i = 0; i < 9; i++) {
      const evs = eventSourceInstances[eventSourceInstances.length - 1];
      evs.readyState = MockEventSource.CLOSED;
      evs.onerror?.(new Event("error"));
      // Worst case delay = 5_000ms + 250ms jitter
      await vi.advanceTimersByTimeAsync(5_500);
    }

    // After exceeding the cap, no more EventSources should be opened.
    const finalCount = eventSourceInstances.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(eventSourceInstances.length).toBe(finalCount);
    // We should have opened more than one (proves backoff actually retried)
    // but stopped before runaway.
    expect(finalCount).toBeGreaterThan(1);
    expect(finalCount).toBeLessThanOrEqual(9);
    // After the cap, the hook must log the "giving up" error exactly once.
    // Logger is mocked — assert on mockLogError, not console.error.
    const givingUpCalls = mockLogError.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("giving up after max retries"),
    );
    expect(givingUpCalls).toHaveLength(1);
  });

  it("registers a server `error` listener and short-circuits retries when the server declares non-retryable", async () => {
    // Server emits `event: error` with `{retryable: false}` for permanent
    // auth failures (forged or cross-interview cookie). The hook must
    // capture that payload, skip its existing backoff loop, and surface
    // the failure to the UI immediately rather than burning all 8 retries.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const evs = customGlobal.lastEventSourceInstance;
    // The server-error listener is wired alongside the existing event
    // listeners — required so the payload arrives BEFORE onerror fires.
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "error",
      expect.any(Function),
    );

    // Server sends the non-retryable error frame, then the browser fires
    // onerror as the connection drops.
    const serverErrorHandler = evs?.listeners?.["error"];
    serverErrorHandler?.({
      data: JSON.stringify({
        reason: "auth_invalid",
        code: 401,
        retryable: false,
      }),
    });

    const first = eventSourceInstances[0];
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    // Advance well past the worst-case backoff window. A non-retryable
    // error must NOT spawn a second EventSource.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(eventSourceInstances).toHaveLength(1);

    // And the "server declared non-retryable" log must have fired exactly
    // once so ops can grep for the reason without reading browser consoles.
    const nonRetryableLogs = mockLogError.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("server declared non-retryable"),
    );
    expect(nonRetryableLogs).toHaveLength(1);
    expect(nonRetryableLogs[0][1]).toMatchObject({
      reason: "auth_invalid",
      code: 401,
    });
  });

  it("keeps retrying when the server error is marked retryable (cookie race)", async () => {
    // The cookie-race case: server emits `{retryable: true}` because the
    // EventSource shipped without the auth cookie. The hook must still
    // apply backoff + open a fresh EventSource so the next attempt — which
    // is most likely to succeed once the cookie store has caught up —
    // actually runs.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const evs = customGlobal.lastEventSourceInstance;
    const serverErrorHandler = evs?.listeners?.["error"];
    serverErrorHandler?.({
      data: JSON.stringify({
        reason: "auth_missing",
        code: 401,
        retryable: true,
      }),
    });

    const first = eventSourceInstances[0];
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    await vi.advanceTimersByTimeAsync(1_000);
    // Retryable → a second EventSource must have been opened.
    expect(eventSourceInstances).toHaveLength(2);
  });

  it("logs first-connect backoff at DEBUG (not WARN) so a benign cookie race does not pollute ops dashboards", async () => {
    // The first 3 backoff cycles within 2 s of mount should NOT log a
    // WARN — they're almost always a SameSite cookie-attach race that
    // self-resolves. The retry still happens; only the log level changes.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    mockLogWarn.mockClear();
    mockLogDebug.mockClear();

    // Fire the first error WITHIN the grace window (mount happened just
    // above; fake timers have only advanced ~0 ms).
    const first = eventSourceInstances[0];
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    // No "SSE stream lost — backing off" WARN should have fired inside
    // the grace window.
    const warnBackingOff = mockLogWarn.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("SSE stream lost — backing off") &&
        !c[0].includes("within first-connect grace"),
    );
    expect(warnBackingOff).toHaveLength(0);

    // But a DEBUG variant with the grace marker MUST have fired so the
    // event is still observable for ops who opt into verbose logs.
    const debugBackingOff = mockLogDebug.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("within first-connect grace"),
    );
    expect(debugBackingOff).toHaveLength(1);
  });

  it("escalates backoff logging to WARN after the first-connect grace window expires", async () => {
    // Once we're past the 2 s grace window OR past the retry threshold,
    // a backoff is no longer "probably a cookie race" and must surface
    // as WARN so on-call notices a stuck stream.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // Burn the entire grace window so the next error falls outside it.
    await vi.advanceTimersByTimeAsync(3_000);

    mockLogWarn.mockClear();
    mockLogDebug.mockClear();

    const first = eventSourceInstances[0];
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    const warnBackingOff = mockLogWarn.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("SSE stream lost — backing off"),
    );
    expect(warnBackingOff).toHaveLength(1);
  });

  it("cancels a pending SSE reconnect on unmount", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const first = eventSourceInstances[0];
    first.readyState = MockEventSource.CLOSED;
    first.onerror?.(new Event("error"));

    expect(eventSourceInstances).toHaveLength(1);

    customGlobal.lastMountCleanup?.();

    // Advancing past the reconnect window must not open a new EventSource —
    // unmount should have cancelled the pending timer.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(eventSourceInstances).toHaveLength(1);
  });

  it("registers canvas_edit SSE listener and applies human edits to canvas state via applyDiff", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // 1. Verify SSE listener is registered
    expect(customGlobal.lastEventSourceInstance?.addEventListener).toHaveBeenCalledWith("canvas_edit", expect.any(Function));

    // 2. Direct unit test of applyDiff for human_edit_applied
    let state: CanvasState = {
      title: null,
      sections: [
        {
          id: "section-1",
          heading: "Old Heading",
          bullets: ["Bullet 0"],
          paragraphs: ["Paragraph 0"],
          quotes: [],
          finalized: false,
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };

    const mockSetCanvas = vi.fn((updater) => {
      state = updater(state);
    });

    // Test heading edit
    applyDiff(mockSetCanvas, {
      type: "human_edit_applied",
      payload: {
        sectionId: "section-1",
        field: "heading",
        value: "Human Edit Heading",
      },
    });

    expect(state.sections[0].heading).toBe("Human Edit Heading");

    // Test paragraph edit
    applyDiff(mockSetCanvas, {
      type: "human_edit_applied",
      payload: {
        sectionId: "section-1",
        field: "paragraph_text",
        index: 0,
        value: "Human Edit Paragraph",
      },
    });

    expect(state.sections[0].paragraphs[0]).toBe("Human Edit Paragraph");

    // Test bullet edit
    applyDiff(mockSetCanvas, {
      type: "human_edit_applied",
      payload: {
        sectionId: "section-1",
        field: "bullet_text",
        index: 0,
        value: "Human Edit Bullet",
      },
    });

    expect(state.sections[0].bullets[0]).toBe("Human Edit Bullet");
  });

  it("applyDiff handles featured_image_updated by setting canvas.featuredImage", () => {
    let state: CanvasState = {
      title: "Featured-image test",
      sections: [],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    const mockSetCanvas = vi.fn((updater) => {
      state = updater(state);
    });

    applyDiff(mockSetCanvas, {
      type: "featured_image_updated",
      payload: {
        image: {
          id: "image-1",
          url: "https://example.com/hero.png",
          alt: "Hero alt",
          prompt: "p",
          placement: { kind: "featured" },
        },
      },
    });

    expect(state.featuredImage).toEqual({
      id: "image-1",
      url: "https://example.com/hero.png",
      alt: "Hero alt",
      prompt: "p",
      placement: { kind: "featured" },
    });

    // null payload (e.g. explicit clear) leaves the field defined but null.
    applyDiff(mockSetCanvas, {
      type: "featured_image_updated",
      payload: { image: null },
    });
    expect(state.featuredImage).toBeNull();
  });

  describe("applyDiff — missing diff kinds wired in W12.7", () => {
    function emptyCanvas(): CanvasState {
      return {
        title: null,
        sections: [],
        meta: { description: null, tags: [], suggestedCategory: null },
      };
    }

    function canvasWithSection(sectionId: string): CanvasState {
      return {
        ...emptyCanvas(),
        sections: [
          {
            id: sectionId,
            heading: "Existing",
            bullets: [],
            paragraphs: [],
            quotes: [],
            finalized: false,
          },
        ],
      };
    }

    function mkSetter(initial: CanvasState) {
      let state = initial;
      // Match React's `Dispatch<SetStateAction<CanvasState>>` shape so the
      // helper can be passed straight into `applyDiff` without a cast — the
      // hook accepts either a replacement value or an updater function.
      const setter = vi.fn(
        (value: CanvasState | ((prev: CanvasState) => CanvasState)) => {
          state = typeof value === "function" ? value(state) : value;
        },
      );
      return { setter, get: () => state };
    }

    it("section_removed drops the matching section by id", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          { id: "s-1", heading: "A", bullets: [], paragraphs: [], quotes: [] },
          { id: "s-2", heading: "B", bullets: [], paragraphs: [], quotes: [] },
        ],
      });
      applyDiff(setter, { type: "section_removed", payload: { sectionId: "s-1" } });
      expect(get().sections).toHaveLength(1);
      expect(get().sections[0].id).toBe("s-2");
    });

    it("sections_reordered rebuilds sections in the server-given order", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          { id: "s-1", heading: "A", bullets: [], paragraphs: [], quotes: [] },
          { id: "s-2", heading: "B", bullets: [], paragraphs: [], quotes: [] },
          { id: "s-3", heading: "C", bullets: [], paragraphs: [], quotes: [] },
        ],
      });
      applyDiff(setter, {
        type: "sections_reordered",
        payload: { sectionIds: ["s-3", "s-1", "s-2"] },
      });
      expect(get().sections.map((s) => s.id)).toEqual(["s-3", "s-1", "s-2"]);
    });

    it("section_merged drops the source section (worker emits section_updated separately)", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          { id: "s-1", heading: "Into", bullets: [], paragraphs: [], quotes: [] },
          { id: "s-2", heading: "From", bullets: [], paragraphs: [], quotes: [] },
        ],
      });
      applyDiff(setter, {
        type: "section_merged",
        payload: { fromSectionId: "s-2", intoSectionId: "s-1" },
      });
      expect(get().sections.map((s) => s.id)).toEqual(["s-1"]);
    });

    it("subtitle_updated / slug_updated / seo_meta_updated populate the matching optional fields", () => {
      const { setter, get } = mkSetter(emptyCanvas());
      applyDiff(setter, { type: "subtitle_updated", payload: { subtitle: "Sub" } });
      expect(get().subtitle).toBe("Sub");

      applyDiff(setter, { type: "slug_updated", payload: { slug: "the-slug" } });
      expect(get().slug).toBe("the-slug");

      applyDiff(setter, {
        type: "seo_meta_updated",
        payload: { metaTitle: "MT", metaDescription: "MD" },
      });
      expect(get().metaTitle).toBe("MT");
      expect(get().metaDescription).toBe("MD");
    });

    it("list_added pushes a list onto the matching section", () => {
      const { setter, get } = mkSetter(canvasWithSection("s-1"));
      applyDiff(setter, {
        type: "list_added",
        payload: {
          sectionId: "s-1",
          list: {
            id: "list-1",
            kind: "bullet",
            items: [{ id: "list-1-item-1", text: "one", level: 0 }],
          },
        },
      });
      const lists = get().sections[0].lists;
      expect(lists).toHaveLength(1);
      expect(lists?.[0].items).toEqual([
        { id: "list-1-item-1", text: "one", level: 0 },
      ]);
    });

    it("list_updated replaces the matching list, or removes it when `list` is omitted", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          {
            id: "s-1",
            heading: "H",
            bullets: [],
            paragraphs: [],
            quotes: [],
            lists: [
              {
                id: "list-1",
                kind: "bullet",
                items: [{ id: "list-1-item-1", text: "one", level: 0 }],
              },
            ],
          },
        ],
      });
      applyDiff(setter, {
        type: "list_updated",
        payload: {
          sectionId: "s-1",
          listId: "list-1",
          list: {
            id: "list-1",
            kind: "bullet",
            items: [
              { id: "list-1-item-1", text: "one", level: 0 },
              { id: "list-1-item-2", text: "two", level: 0 },
            ],
          },
        },
      });
      expect(get().sections[0].lists?.[0].items).toHaveLength(2);

      applyDiff(setter, {
        type: "list_updated",
        payload: { sectionId: "s-1", listId: "list-1" },
      });
      expect(get().sections[0].lists).toEqual([]);
    });

    it("inline_image_added appends to the section's inlineImages array", () => {
      const { setter, get } = mkSetter(canvasWithSection("s-1"));
      applyDiff(setter, {
        type: "inline_image_added",
        payload: {
          sectionId: "s-1",
          image: {
            id: "img-1",
            url: "https://example.com/x.png",
            alt: "alt",
            placement: { kind: "inline", sectionId: "s-1" },
          },
        },
      });
      expect(get().sections[0].inlineImages).toEqual([
        {
          id: "img-1",
          url: "https://example.com/x.png",
          alt: "alt",
          placement: { kind: "inline", sectionId: "s-1" },
        },
      ]);
    });

    it("image_alt_updated patches alt on featured + inline images by id", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        featuredImage: {
          id: "feat-1",
          url: "https://example.com/feat.png",
          alt: "old",
          placement: { kind: "featured" },
        },
        sections: [
          {
            id: "s-1",
            heading: "H",
            bullets: [],
            paragraphs: [],
            quotes: [],
            inlineImages: [
              {
                id: "inline-1",
                url: "https://example.com/inline.png",
                alt: "old inline",
                placement: { kind: "inline", sectionId: "s-1" },
              },
            ],
          },
        ],
      });
      applyDiff(setter, {
        type: "image_alt_updated",
        payload: { imageId: "feat-1", alt: "new featured" },
      });
      expect(get().featuredImage?.alt).toBe("new featured");

      applyDiff(setter, {
        type: "image_alt_updated",
        payload: { imageId: "inline-1", alt: "new inline" },
      });
      expect(get().sections[0].inlineImages?.[0].alt).toBe("new inline");
    });

    it("seo_score_updated / internal_link_suggestions_updated populate sidebar slots", () => {
      const { setter, get } = mkSetter(emptyCanvas());
      applyDiff(setter, {
        type: "seo_score_updated",
        payload: {
          score: {
            score: 78,
            issues: ["short title"],
            suggestions: ["expand intro"],
            scoredAt: "2026-05-22T03:55:00.000Z",
          },
        },
      });
      expect(get().seoScore?.score).toBe(78);

      applyDiff(setter, {
        type: "internal_link_suggestions_updated",
        payload: {
          suggestions: [
            { phrase: "blog", targetSlug: "/blog", reason: "topic match" },
          ],
        },
      });
      expect(get().internalLinkSuggestions).toEqual([
        { phrase: "blog", targetSlug: "/blog", reason: "topic match" },
      ]);
    });

    it("internal_link_added appends to the section's internalLinks side-table", () => {
      const { setter, get } = mkSetter(canvasWithSection("s-1"));
      applyDiff(setter, {
        type: "internal_link_added",
        payload: {
          sectionId: "s-1",
          paragraphId: "p-1",
          range: { start: 0, end: 4 },
          targetSlug: "/about",
        },
      });
      expect(get().sections[0].internalLinks).toEqual([
        { paragraphId: "p-1", range: { start: 0, end: 4 }, targetSlug: "/about" },
      ]);
    });

    it("keywords_updated / categories_updated / tags_updated mirror the payload arrays", () => {
      const { setter, get } = mkSetter(emptyCanvas());
      applyDiff(setter, {
        type: "keywords_updated",
        payload: { keywords: ["a", "b"] },
      });
      expect(get().keywords).toEqual(["a", "b"]);

      applyDiff(setter, {
        type: "categories_updated",
        payload: { categories: ["cat-1"] },
      });
      expect(get().categories).toEqual(["cat-1"]);

      applyDiff(setter, { type: "tags_updated", payload: { tags: ["tag-1"] } });
      expect(get().tags).toEqual(["tag-1"]);
    });

    it("section_added on an empty canvas surfaces the section the TipTap renderer reads from", () => {
      const { setter, get } = mkSetter(emptyCanvas());
      applyDiff(setter, {
        type: "section_added",
        payload: {
          id: "section-1",
          heading: "Tips for Sustainable Growth",
          bullets: [],
          paragraphs: [],
          quotes: [],
          finalized: false,
        },
      });
      expect(get().sections).toHaveLength(1);
      expect(get().sections[0].heading).toBe("Tips for Sustainable Growth");
    });

    it("section_added is idempotent under an SSE replay storm — 5 reconnects each replaying the same section yield sectionCount=1", () => {
      // Production regression: when SSE drops every ~30s the server
      // re-fans every event in the subcollection on each reconnect,
      // which used to append the same section N times. The applyDiff
      // reducer must dedup by `sectionId` so the canvas stays
      // sectionCount=1 no matter how many times the same diff replays.
      const { setter, get } = mkSetter(emptyCanvas());
      const replayPayload = {
        id: "section-1",
        heading: "Definition and Origin",
        bullets: [],
        paragraphs: [],
        quotes: [],
        finalized: false,
      };
      // Simulate the production timeline: 1 initial delivery + 5
      // reconnects, each replaying the same `section_added`.
      for (let i = 0; i < 6; i++) {
        applyDiff(setter, { type: "section_added", payload: replayPayload });
      }
      expect(get().sections).toHaveLength(1);
      expect(get().sections[0].heading).toBe("Definition and Origin");
    });

    it("title_updated / subtitle_updated / slug_updated / featured_image_updated are no-ops when the value already matches", () => {
      // Belt-and-braces: content-based dedup so a replay storm that
      // re-fans these single-slot diffs returns the previous state
      // reference (skipping the render path entirely).
      const baseImage: CanvasImage = {
        id: "img-1",
        url: "https://example.com/x.png",
        alt: "alt",
        placement: { kind: "featured" },
      };
      const initial: CanvasState = {
        title: "T",
        subtitle: "S",
        slug: "the-slug",
        sections: [],
        meta: { description: null, tags: [], suggestedCategory: null },
        featuredImage: baseImage,
      };
      const { setter, get } = mkSetter(initial);
      const before = get();
      applyDiff(setter, { type: "title_updated", payload: { title: "T" } });
      applyDiff(setter, { type: "subtitle_updated", payload: { subtitle: "S" } });
      applyDiff(setter, { type: "slug_updated", payload: { slug: "the-slug" } });
      applyDiff(setter, {
        type: "featured_image_updated",
        payload: { image: { ...baseImage } },
      });
      // Same reference: applyDiff must `return prev` rather than build a
      // shallow clone. Without this, even a no-op replay triggers a full
      // re-render of every subscriber to the canvas.
      expect(get()).toBe(before);
    });

    it("section_updated bullets payload (emitted by add_bullet) lands on the right section", () => {
      const { setter, get } = mkSetter(canvasWithSection("section-1"));
      applyDiff(setter, {
        type: "section_updated",
        payload: { id: "section-1", bullets: ["First bullet"] },
      });
      expect(get().sections[0].bullets).toEqual(["First bullet"]);
    });

    it("upsert_paragraph appends a new paragraph + paragraphId to the target section", () => {
      const { setter, get } = mkSetter(canvasWithSection("s-1"));
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "s-1", paragraphId: "s-1-p-0", text: "First body line." },
      });
      const sec = get().sections[0];
      expect(sec.paragraphs).toEqual(["First body line."]);
      expect(sec.paragraphIds).toEqual(["s-1-p-0"]);
    });

    it("upsert_paragraph replaces text in place when paragraphId already exists (idempotent on same content)", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          {
            id: "s-1",
            heading: "H",
            bullets: [],
            paragraphs: ["original text"],
            paragraphIds: ["s-1-p-0"],
            quotes: [],
            finalized: false,
          },
        ],
      });
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "s-1", paragraphId: "s-1-p-0", text: "refined text" },
      });
      expect(get().sections[0].paragraphs).toEqual(["refined text"]);
      expect(get().sections[0].paragraphIds).toEqual(["s-1-p-0"]);

      // Replay with same id + same text — no-op, same reference back.
      const before = get();
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "s-1", paragraphId: "s-1-p-0", text: "refined text" },
      });
      expect(get()).toBe(before);
    });

    it("upsert_paragraph falls back to the most recent section when sectionId is omitted or unknown", () => {
      const { setter, get } = mkSetter({
        ...emptyCanvas(),
        sections: [
          { id: "s-1", heading: "First", bullets: [], paragraphs: [], quotes: [] },
          { id: "s-2", heading: "Second", bullets: [], paragraphs: [], quotes: [] },
        ],
      });
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { paragraphId: "s-2-p-0", text: "no sectionId given" },
      });
      expect(get().sections[1].paragraphs).toEqual(["no sectionId given"]);

      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "never-existed", paragraphId: "s-2-p-1", text: "unknown sectionId" },
      });
      expect(get().sections[1].paragraphs).toEqual([
        "no sectionId given",
        "unknown sectionId",
      ]);
    });

    it("upsert_paragraph is dropped when there are no sections to anchor onto", () => {
      const { setter, get } = mkSetter(emptyCanvas());
      const before = get();
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { paragraphId: "ghost-p-0", text: "no anchor" },
      });
      // Canvas stays empty; no implicit section is minted on the client.
      expect(get().sections).toEqual([]);
      // We DID rebuild state (the mutation took the non-`return prev` path
      // because there's no idempotency anchor), so we don't assert strict
      // reference equality — assert the sections array stayed empty.
      void before;
    });

    it("upsert_paragraph is dropped when the payload is missing paragraphId or text", () => {
      const { setter, get } = mkSetter(canvasWithSection("s-1"));
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "s-1", text: "no id" } as unknown as Record<string, unknown>,
      });
      applyDiff(setter, {
        type: "upsert_paragraph",
        payload: { sectionId: "s-1", paragraphId: "p-1" } as unknown as Record<string, unknown>,
      });
      expect(get().sections[0].paragraphs).toEqual([]);
    });

    it("unknown diff kinds are dropped with a structured warning and leave canvas untouched", () => {
      const { setter, get } = mkSetter(canvasWithSection("section-1"));
      const before = get();
      applyDiff(setter, {
        type: "completely_made_up_kind",
        payload: { hello: "world" },
      });
      expect(get()).toBe(before);
      const warnCalls = mockLogWarn.mock.calls.filter(
        (c) => c[0] === "Dropping unknown SSE diff kind",
      );
      expect(warnCalls.length).toBeGreaterThanOrEqual(1);
      expect(warnCalls[warnCalls.length - 1][1]).toMatchObject({
        kind: "completely_made_up_kind",
      });
    });

    it("applied diffs emit a structured 'applied SSE diff' log with kind + sectionId", () => {
      const { setter } = mkSetter(canvasWithSection("section-1"));
      mockLogInfo.mockClear();
      applyDiff(setter, {
        type: "section_updated",
        payload: { id: "section-1", bullets: ["a"] },
      });
      const appliedLog = mockLogInfo.mock.calls.find(
        (c) => c[0] === "applied SSE diff",
      );
      expect(appliedLog).toBeDefined();
      expect(appliedLog![1]).toMatchObject({
        kind: "section_updated",
        sectionId: "section-1",
        sectionCount: 1,
      });
    });
  });

  it("logs realtime state transitions with previous + next state", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();
    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();

    clientEvents?.onStateChange("connecting");
    clientEvents?.onStateChange("live");

    const stateLogs = mockLogInfo.mock.calls.filter(
      (c) => c[0] === "RealtimeClient state changed",
    );
    expect(stateLogs).toHaveLength(2);
    expect(stateLogs[0][1]).toMatchObject({ from: "idle", to: "connecting", interviewId: "int-123" });
    expect(stateLogs[1][1]).toMatchObject({ from: "connecting", to: "live", interviewId: "int-123" });
  });

  it("logs orb state transitions with from/to/reason on realtime state change", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();
    const clientEvents = customGlobal.lastRealtimeClientEvents;

    clientEvents?.onStateChange("live");

    const orbLogs = mockLogInfo.mock.calls.filter(
      (c) => c[0] === "Orb state transition",
    );
    expect(orbLogs.length).toBeGreaterThan(0);
    expect(orbLogs[0][1]).toMatchObject({
      from: "idle",
      to: "listening",
      reason: expect.stringContaining("->live"),
      interviewId: "int-123",
    });
  });

  it("logs orb state transitions when user mutes/unmutes", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    let session: { mute?: (m: boolean) => void } = {};
    renderToStaticMarkup(<TestWrapper input={input} onRef={(ref) => { session = ref as unknown as { mute?: (m: boolean) => void }; }} />);
    await flushMicrotasks();
    const clientEvents = customGlobal.lastRealtimeClientEvents;

    // First move to listening so muted->listening transition has a distinct from
    clientEvents?.onStateChange("live");
    mockLogInfo.mockClear();

    session.mute?.(true);
    const muteLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Orb state transition" && c[1]?.to === "muted",
    );
    expect(muteLog).toBeDefined();
    expect(muteLog?.[1]).toMatchObject({ from: "listening", to: "muted", reason: "user_muted" });
  });

  it("logs the FIRST writer_diff event with waitMs and diff type", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();
    const evs = customGlobal.lastEventSourceInstance;
    const writerDiffHandler = evs?.listeners?.["writer_diff"];
    expect(writerDiffHandler).toBeDefined();

    mockLogInfo.mockClear();

    writerDiffHandler?.({ data: JSON.stringify({ type: "section_added", payload: { id: "s1" } }) });
    writerDiffHandler?.({ data: JSON.stringify({ type: "section_updated", payload: { id: "s1" } }) });

    const firstWriterLogs = mockLogInfo.mock.calls.filter(
      (c) => c[0] === "First writer_diff event received",
    );
    expect(firstWriterLogs).toHaveLength(1);
    expect(firstWriterLogs[0][1]).toMatchObject({
      interviewId: "int-123",
      diffType: "section_added",
      waitMs: expect.any(Number),
    });
  });

  it("blocks startup when another tab holds a fresh session lock", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    mockFetch.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/session-lock") && init?.method !== "POST" && init?.method !== "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ holder: "other-tab", lastBeatAt: Date.now(), stale: false }),
        });
      }
      if (u.includes("/canvas-snapshot")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ canvas: null, snapshotAt: null }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // Lock check resolved with a contending fresh holder — the hook must NOT
    // have called connect or opened a session-lock POST heartbeat.
    expect(mockConnect).not.toHaveBeenCalled();
    const heartbeatPost = mockFetch.mock.calls.find(
      (c) =>
        String(c[0]).includes("/session-lock") && c[1]?.method === "POST",
    );
    expect(heartbeatPost).toBeUndefined();
    // The "Session lock contested" info log was emitted with the holder id.
    const blockedLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Session lock contested — pausing startup",
    );
    expect(blockedLog).toBeDefined();
    expect(blockedLog?.[1]).toMatchObject({ holder: "other-tab" });
  });

  it("treats a stale heartbeat as abandoned and starts the session without takeover", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    mockFetch.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/session-lock") && init?.method !== "POST" && init?.method !== "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              holder: "ghost-tab",
              lastBeatAt: Date.now() - 60_000,
              stale: true,
            }),
        });
      }
      if (u.includes("/session-lock") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "acquired" }),
        });
      }
      if (u.includes("/canvas-snapshot")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ canvas: null, snapshotAt: null }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // Stale holder = silent acquire — realtime connect must have run.
    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeralToken: "token-oai" }),
    );
  });

  it("restores canvas state from a snapshot on mount and logs restoration", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    mockFetch.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/session-lock") && init?.method !== "POST" && init?.method !== "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ holder: null, lastBeatAt: null, stale: false }),
        });
      }
      if (u.includes("/session-lock") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "acquired" }),
        });
      }
      if (u.includes("/canvas-snapshot")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              canvas: {
                title: "Recovered Article",
                sections: [
                  {
                    id: "s1",
                    heading: "Existing heading",
                    bullets: [],
                    paragraphs: ["already written"],
                    quotes: [],
                    finalized: false,
                  },
                ],
                meta: { description: null, tags: [], suggestedCategory: null },
              },
              snapshotAt: 1234567890,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // The snapshot fetch happens as a same-origin GET; the interview token
    // is sent as the HttpOnly `interview_token_<id>` cookie set by /consent,
    // not in an Authorization header.
    const snapFetch = mockFetch.mock.calls.find(
      (c) => String(c[0]).includes("/canvas-snapshot"),
    );
    expect(snapFetch).toBeDefined();
    expect(snapFetch![1]).toMatchObject({
      method: "GET",
      credentials: "same-origin",
    });
    // A restoration info log was emitted with section count + snapshotAt.
    const restoreLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Restored canvas from snapshot",
    );
    expect(restoreLog).toBeDefined();
    expect(restoreLog?.[1]).toMatchObject({
      interviewId: "int-123",
      sectionCount: 1,
      snapshotAt: 1234567890,
    });
  });

  it("registers SSE listeners for tool_call and tool_failed events", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    interface SessionRef {
      recentToolCalls?: Array<unknown>;
    }
    let session: SessionRef = {};
    renderToStaticMarkup(
      <TestWrapper
        input={input}
        onRef={(ref) => {
          session = ref as SessionRef;
        }}
      />,
    );
    await flushMicrotasks();

    // `recentToolCalls` is part of the hook's public surface — the feed
    // component reads from it.
    expect(session.recentToolCalls).toBeDefined();
    expect(Array.isArray(session.recentToolCalls)).toBe(true);

    // The SSE pipeline must subscribe to the tool-lifecycle events emitted
    // by the stream route so the in-canvas activity feed gets real-time
    // updates.
    const evs = customGlobal.lastEventSourceInstance;
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "tool_call",
      expect.any(Function),
    );
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "tool_failed",
      expect.any(Function),
    );

    // The handlers must be wired (the mock records them by event name);
    // payload-handling logic is exercised end-to-end via the feed component
    // tests.
    expect(evs?.listeners?.["tool_call"]).toBeTypeOf("function");
    expect(evs?.listeners?.["tool_failed"]).toBeTypeOf("function");

    // Calling the handlers with a malformed payload must not throw — the
    // hook must defensively swallow JSON parse errors so a noisy stream
    // never wedges the interview.
    expect(() =>
      evs?.listeners?.["tool_call"]?.({ data: "{not json" }),
    ).not.toThrow();
    expect(() =>
      evs?.listeners?.["tool_failed"]?.({ data: "{not json" }),
    ).not.toThrow();

    // Narration cue events must be wired so the AI is never silent during
    // a tool call. Without these the SSE stream carries the tool result
    // but the realtime model never hears about it.
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "tool_result",
      expect.any(Function),
    );
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "tool_in_flight",
      expect.any(Function),
    );
    expect(evs?.addEventListener).toHaveBeenCalledWith(
      "tool_completed",
      expect.any(Function),
    );
    expect(evs?.listeners?.["tool_result"]).toBeTypeOf("function");
    expect(evs?.listeners?.["tool_in_flight"]).toBeTypeOf("function");
    expect(evs?.listeners?.["tool_completed"]).toBeTypeOf("function");
    expect(() =>
      evs?.listeners?.["tool_result"]?.({ data: "{not json" }),
    ).not.toThrow();
    expect(() =>
      evs?.listeners?.["tool_in_flight"]?.({ data: "{not json" }),
    ).not.toThrow();
    expect(() =>
      evs?.listeners?.["tool_completed"]?.({ data: "{not json" }),
    ).not.toThrow();
  });

  it("pushes a narration cue into the realtime client when a tool_in_flight SSE event arrives", async () => {
    // The user can't see the canvas — without this push, the AI calls a
    // fire-and-forget tool and goes silent for the entire upstream
    // round-trip. The hook must surface the SSE cue back to the realtime
    // session so the model speaks.
    const input = {
      interviewId: "int-narrate",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(
      <TestWrapper input={input} onRef={() => {}} />,
    );
    await flushMicrotasks();

    const evs = customGlobal.lastEventSourceInstance;
    const mockClient = customGlobal.lastMockRealtimeClient;
    expect(mockClient?.sendNarrationCue).toBeDefined();

    evs?.listeners?.["tool_in_flight"]?.({
      data: JSON.stringify({ toolName: "request_featured_image" }),
    });
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(1);
    // The cue must surface a friendly, human label — never the raw tool id.
    // The new interviewer persona forbids tool-name jargon in voice output.
    expect(mockClient?.sendNarrationCue.mock.calls[0][0]).toContain(
      "Generating a featured image",
    );
    expect(mockClient?.sendNarrationCue.mock.calls[0][0]).not.toContain(
      "request_featured_image",
    );
    expect(mockClient?.sendNarrationCue.mock.calls[0][0]).toMatch(
      /background|few seconds|conversation alive/i,
    );

    evs?.listeners?.["tool_result"]?.({
      data: JSON.stringify({
        toolName: "set_title",
        ok: true,
        summary: "title_set",
      }),
    });
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(2);
    expect(mockClient?.sendNarrationCue.mock.calls[1][0]).toContain(
      "Setting the title",
    );
    expect(mockClient?.sendNarrationCue.mock.calls[1][0]).not.toContain("set_title");

    evs?.listeners?.["tool_completed"]?.({
      data: JSON.stringify({
        toolName: "request_featured_image",
        ok: true,
        summary: "featured_image_ready",
      }),
    });
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(3);
  });

  it("dedupes identical narration cues replayed within 500ms of a reconnect (catch-up storm)", async () => {
    // Production logs showed SSE drops every ~30s; each reconnect causes
    // the server to replay every event since `lastEventId`, which on a
    // busy session floods the realtime data channel with N copies of the
    // same `tool_result` / `tool_in_flight` / `tool_completed` cue. The
    // hook must drop duplicates within NARRATION_CUE_DEDUP_WINDOW_MS so
    // the AI does not narrate the same tool five times in a row.
    const input = {
      interviewId: "int-dedup",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(
      <TestWrapper input={input} onRef={() => {}} />,
    );
    await flushMicrotasks();

    const evs = customGlobal.lastEventSourceInstance;
    const mockClient = customGlobal.lastMockRealtimeClient;
    expect(mockClient?.sendNarrationCue).toBeDefined();

    // Simulate the catch-up replay: fire the same `tool_result` payload
    // five times back-to-back, the way Firestore's `onSnapshot` rehydrates
    // every missed event on reconnect.
    const replayedPayload = JSON.stringify({
      toolName: "set_title",
      ok: true,
      summary: "title_set",
    });
    for (let i = 0; i < 5; i++) {
      evs?.listeners?.["tool_result"]?.({ data: replayedPayload });
    }

    // Only the first push should reach the realtime client — the next four
    // are duplicates inside the dedup window.
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(1);

    // A genuinely-different cue (different tool) must NOT be dropped — the
    // dedup key is the full cue text, not just the kind.
    evs?.listeners?.["tool_result"]?.({
      data: JSON.stringify({
        toolName: "insert_section",
        ok: true,
        summary: "section_added",
      }),
    });
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(2);

    // After the dedup window expires, the same cue is allowed through
    // again — two genuinely-separate tool dispatches should both narrate.
    await vi.advanceTimersByTimeAsync(NARRATION_CUE_DEDUP_WINDOW_MS + 50);
    evs?.listeners?.["tool_result"]?.({ data: replayedPayload });
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(3);
  });

  it("shouldForwardNarrationCue forwards first occurrence and drops duplicates inside the window", () => {
    // Pure unit test of the dedup contract — no hook, no EventSource, no
    // realtime client. Locks down the behaviour the integration test
    // above relies on so a regression in the helper is caught
    // independently of the SSE plumbing.
    const state = new Map<string, number>();
    expect(shouldForwardNarrationCue(state, "tool_result:set_title ok", 1_000)).toBe(true);
    // Same key, inside the window — must drop.
    expect(shouldForwardNarrationCue(state, "tool_result:set_title ok", 1_100)).toBe(false);
    expect(shouldForwardNarrationCue(state, "tool_result:set_title ok", 1_499)).toBe(false);
    // Different key, inside the window — must forward (only identical
    // cues collide).
    expect(shouldForwardNarrationCue(state, "tool_result:insert_section ok", 1_100)).toBe(true);
    // Same key, outside the window — must forward again.
    expect(shouldForwardNarrationCue(state, "tool_result:set_title ok", 1_500)).toBe(true);
  });

  it("shouldForwardNarrationCue prunes stale entries so the map stays bounded", () => {
    // Regression guard for the implicit memory contract: a long-running
    // session must not accumulate one map entry per distinct cue forever.
    // After every forwarded push, entries older than the window must be
    // evicted.
    const state = new Map<string, number>();
    shouldForwardNarrationCue(state, "k1", 1_000);
    shouldForwardNarrationCue(state, "k2", 1_100);
    expect(state.size).toBe(2);
    // Jump past the window — the next forwarded push must evict both
    // stale entries before recording the new one.
    shouldForwardNarrationCue(state, "k3", 2_000);
    expect(state.has("k1")).toBe(false);
    expect(state.has("k2")).toBe(false);
    expect(state.has("k3")).toBe(true);
  });

  it("transitions the orb on conversation-state events from the realtime client", async () => {
    // W9.2 regression: the orb was stuck on `listening` because the hook only
    // mapped *connection-level* RealtimeClientState. The data-channel emits
    // turn-level conversation states (`user_speaking` / `ai_thinking` /
    // `ai_speaking` / `ai_done`); the hook must wire those onto orb states.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    interface SessionRef {
      orbState?: string;
    }
    let session: SessionRef = {};
    let renderCount = 0;
    const onRef = (ref: unknown) => {
      session = ref as SessionRef;
      renderCount++;
    };
    renderToStaticMarkup(<TestWrapper input={input} onRef={onRef} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();
    // The realtime client must have been constructed with an
    // `onConversationState` callback — otherwise nothing wires the orb to
    // turn-level events and the bug reappears.
    expect(clientEvents?.onConversationState).toBeTypeOf("function");

    // Bring the connection to "live" so the orb sits at "listening" first;
    // every conversation transition must override that ambient state.
    clientEvents?.onStateChange("live");

    mockLogInfo.mockClear();

    clientEvents?.onConversationState?.("ai_speaking");
    const speakingLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Orb state transition" && c[1]?.to === "speaking",
    );
    expect(speakingLog).toBeDefined();
    expect(speakingLog?.[1]).toMatchObject({
      to: "speaking",
      reason: "conversation:ai_speaking",
    });

    clientEvents?.onConversationState?.("ai_thinking");
    const thinkingLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Orb state transition" && c[1]?.to === "thinking",
    );
    expect(thinkingLog).toBeDefined();
    expect(thinkingLog?.[1]).toMatchObject({
      to: "thinking",
      reason: "conversation:ai_thinking",
    });

    clientEvents?.onConversationState?.("user_speaking");
    clientEvents?.onConversationState?.("ai_done");
    // Both user_speaking and ai_done map to `listening` (ambient + ready).
    const listeningTransitions = mockLogInfo.mock.calls.filter(
      (c) =>
        c[0] === "Orb state transition" &&
        c[1]?.to === "listening" &&
        typeof c[1]?.reason === "string" &&
        (c[1].reason as string).startsWith("conversation:"),
    );
    expect(listeningTransitions.length).toBeGreaterThanOrEqual(1);

    // Touch unused vars so the test stays meaningful when the assertion runs.
    void session;
    void renderCount;
  });

  it("does NOT overwrite a `muted` orb on conversation-state events", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    let session: { mute?: (m: boolean) => void } = {};
    renderToStaticMarkup(
      <TestWrapper
        input={input}
        onRef={(ref) => {
          session = ref as { mute?: (m: boolean) => void };
        }}
      />,
    );
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    clientEvents?.onStateChange("live");
    session.mute?.(true);

    mockLogInfo.mockClear();

    // Conversation events arriving while muted must NOT change the orb;
    // muted is a sticky user-driven state.
    clientEvents?.onConversationState?.("ai_speaking");
    clientEvents?.onConversationState?.("ai_thinking");

    const conversationDriven = mockLogInfo.mock.calls.filter(
      (c) =>
        c[0] === "Orb state transition" &&
        typeof c[1]?.reason === "string" &&
        (c[1].reason as string).startsWith("conversation:"),
    );
    expect(conversationDriven).toHaveLength(0);
  });

  it("parseToolCallSseEvent shapes a tool_call SSE payload into a ToolCallActivity row", () => {
    // W9.2 regression: the feed never rendered tool-call rows. Verify the
    // pure SSE→activity reducer used by `handleToolCall` so the bug cannot
    // silently regress at the data-shape boundary.
    const entry = parseToolCallSseEvent(
      JSON.stringify({
        name: "insert_section",
        callId: "call-1",
        arguments: { heading: "Why this matters" },
      }),
      1_700_000_000_000,
    );
    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({
      name: "insert_section",
      label: "Why this matters",
      status: "applied",
      observedAt: 1_700_000_000_000,
    });
    expect(entry?.key).toContain("call-1");
  });

  it("parseToolFailedSseEvent shapes a tool_failed SSE payload with status=failed and the error message", () => {
    const entry = parseToolFailedSseEvent(
      JSON.stringify({
        toolName: "set_meta",
        callId: "call-9",
        message: "Upstream 503",
        errorKind: "upstream_error",
      }),
      1_700_000_000_001,
    );
    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({
      name: "set_meta",
      status: "failed",
      errorMessage: "Upstream 503",
      observedAt: 1_700_000_000_001,
    });
    expect(entry?.key).toContain("call-9");
    expect(entry?.key).toContain("failed");
  });

  it("parseToolCallSseEvent / parseToolFailedSseEvent return null when the payload lacks a name", () => {
    expect(parseToolCallSseEvent(JSON.stringify({}), 0)).toBeNull();
    expect(parseToolFailedSseEvent(JSON.stringify({}), 0)).toBeNull();
  });

  it("toolCallEntryFromRealtime shapes a realtime data-channel tool call so the feed survives SSE drops", () => {
    // W9.2 regression: the feed was empty in practice because only the SSE
    // path appended to `recentToolCalls`. The realtime data-channel is the
    // first witness to a tool invocation; surface it immediately so the live
    // feed renders even while SSE is mid-reconnect.
    const entry = toolCallEntryFromRealtime(
      {
        name: "set_title",
        callId: "rtc-1",
        arguments: { title: "How we ship faster" },
      },
      1_700_000_000_002,
    );
    expect(entry).toMatchObject({
      name: "set_title",
      label: "How we ship faster",
      status: "applied",
      observedAt: 1_700_000_000_002,
    });
    // The `-rtc` suffix distinguishes realtime-sourced rows from SSE-sourced
    // rows so duplicate observations on both paths cannot collide as the
    // same React key.
    expect(entry.key).toContain("rtc-1");
    expect(entry.key.endsWith("-rtc")).toBe(true);
  });

  it("wires the realtime client's onToolCall callback so live-feed updates fire on the realtime path", async () => {
    // We can't observe state changes through renderToStaticMarkup, but we
    // can verify the hook wires onToolCall — the pure
    // `toolCallEntryFromRealtime` reducer is asserted separately above.
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };
    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();
    expect(clientEvents?.onToolCall).toBeTypeOf("function");
    // Calling the wired handler with a realtime-shape payload must not
    // throw — proves the realtime → recentToolCalls bridge is connected.
    expect(() =>
      clientEvents?.onToolCall({
        name: "set_title",
        arguments: { title: "Hello" },
      }),
    ).not.toThrow();
  });

  it("invokes onEndRequested and forces the realtime channel closed when the AI calls end_interview", async () => {
    // Without this wiring the AI emits an `end_interview` tool call and
    // the canvas tools dispatcher just acks the call server-side — the
    // user is stranded on the call screen because nothing on the client
    // POSTs /end. This test pins the AI → /end signal so a future
    // refactor cannot silently regress the trust-critical "end the
    // interview" command.
    const onEndRequested = vi.fn();
    const input = {
      interviewId: "int-end-wire",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
      onEndRequested,
    };

    interface SessionRef {
      endRequestedAt?: number | null;
    }
    let session: SessionRef = {};
    renderToStaticMarkup(
      <TestWrapper
        input={input}
        onRef={(ref) => {
          session = ref as SessionRef;
        }}
      />,
    );
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();

    // Hook surface defaults `endRequestedAt` to null until the first
    // end_interview call. Snapshot it BEFORE driving the tool call so the
    // post-call assertion proves a state transition happened.
    expect(session.endRequestedAt ?? null).toBeNull();

    // Drive the AI tool call directly through the realtime callback
    // surface — same path the OpenAI Realtime data channel exercises in
    // production.
    clientEvents?.onToolCall({
      name: "end_interview",
      arguments: { reason: "user said wrap up" },
    });

    // The consumer callback must fire so the in-call layout can POST
    // /end + navigate. This is the load-bearing assertion — the original
    // bug was the AI's end signal had no listener.
    expect(onEndRequested).toHaveBeenCalledTimes(1);

    // The realtime channel must be torn down BEFORE the consumer drives
    // /end so the AI cannot keep talking after asking to end. Mirrors
    // the End Session button's `session.end()` call ordering.
    expect(mockForceEnd).toHaveBeenCalled();

    // A non-end tool name must not invoke the end callback — this
    // catches a regression where the wiring matched too broadly.
    clientEvents?.onToolCall({
      name: "set_title",
      arguments: { title: "Hello" },
    });
    expect(onEndRequested).toHaveBeenCalledTimes(1);
  });

  it("does not throw when end_interview fires without an onEndRequested consumer", async () => {
    // The hook surface treats `onEndRequested` as optional so a future
    // consumer (e.g. mobile layout, mock harness) can mount without
    // wiring the callback. Verify the data-channel path stays safe in
    // that case — the hook still surfaces `endRequestedAt` for any UI
    // that wants to render a banner.
    const input = {
      interviewId: "int-end-nocb",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };
    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(() =>
      clientEvents?.onToolCall({
        name: "end_interview",
        arguments: {},
      }),
    ).not.toThrow();
  });

  it("exposes chatTurns on the hook surface and wires the realtime onAiChatTurn callback", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    interface SessionRef {
      chatTurns?: Array<unknown>;
    }
    let session: SessionRef = {};
    renderToStaticMarkup(
      <TestWrapper
        input={input}
        onRef={(ref) => {
          session = ref as SessionRef;
        }}
      />,
    );
    await flushMicrotasks();

    // The new bidirectional chat log reads `chatTurns` off the hook — it
    // must be an array on first render (empty until the first turn arrives).
    expect(session.chatTurns).toBeDefined();
    expect(Array.isArray(session.chatTurns)).toBe(true);
    expect(session.chatTurns).toHaveLength(0);

    // The hook must construct the RealtimeClient with an `onAiChatTurn`
    // callback — without this the data channel surfaces the audio transcript
    // but the chat log never receives the AI response (W11 regression).
    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents?.onAiChatTurn).toBeTypeOf("function");

    // Calling the handler with a realtime-shape payload must not throw —
    // proves the bridge from realtime to chat-turn state is wired.
    expect(() =>
      clientEvents?.onAiChatTurn({
        text: "Here's why I'm erroring",
        timestamp: 1_700_000_000_000,
      }),
    ).not.toThrow();
  });

  it("forwards interviewId to RealtimeClient.connect so the first_ai_turn boot log can correlate the session", async () => {
    // Ops greps `interviews:realtime-client first_ai_turn` to verify the
    // AI greeted; without the interview id in the connect payload the log
    // cannot be correlated with the specific guest session.
    const input = {
      interviewId: "int-greet-correlate",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ interviewId: "int-greet-correlate" }),
    );
  });

  it("emits an ai_greeting_timeout warning when no AI turn arrives within 5 s of going live", async () => {
    // The boot-greeting directive (PR #196 + #257) can regress silently if
    // the system prompt is overwritten. This hook-level safety net surfaces
    // the regression as a structured WARN in gcloud so prod incidents are
    // visible without a human noticing a quiet AI in QA.
    const input = {
      interviewId: "int-no-greet",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    expect(clientEvents).toBeDefined();
    clientEvents?.onStateChange("live");

    mockLogWarn.mockClear();

    // Advance well past the 5 s window — no `ai_speaking` / `onAiChatTurn`
    // was ever fired, so the timeout warning must land.
    await vi.advanceTimersByTimeAsync(5_500);

    const timeoutWarns = mockLogWarn.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0] === "ai_greeting_timeout",
    );
    expect(timeoutWarns).toHaveLength(1);
    expect(timeoutWarns[0][1]).toMatchObject({
      interviewId: "int-no-greet",
      waitedMs: 5_000,
    });
  });

  it("cancels the greeting timeout once the AI's first turn arrives", async () => {
    // Happy path: as soon as `ai_speaking` (or the first chat turn) fires
    // the timeout must be cleared so a healthy session does NOT emit the
    // warning. Otherwise every successful interview would log a false
    // positive after 5 s.
    const input = {
      interviewId: "int-greet-ok",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    const clientEvents = customGlobal.lastRealtimeClientEvents;
    clientEvents?.onStateChange("live");

    // AI starts speaking at t=1s, well inside the 5 s window.
    await vi.advanceTimersByTimeAsync(1_000);
    clientEvents?.onConversationState?.("ai_speaking");

    mockLogWarn.mockClear();

    // Advance past the original 5 s window — no warning may fire because
    // the first AI turn already cancelled the timer.
    await vi.advanceTimersByTimeAsync(10_000);

    const timeoutWarns = mockLogWarn.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0] === "ai_greeting_timeout",
    );
    expect(timeoutWarns).toHaveLength(0);
  });

  it("sendTimeRemainingCue forwards wrap-up nudges through the narration-cue pipe (W24L)", async () => {
    // The duration timer fires wrap-up nudges (60s + 15s remaining) so the
    // AI ends the call gracefully instead of being cut off mid-sentence at
    // the cap. The hook must expose a stable callback that routes the cue
    // text through the same dedup window + structured logging the
    // tool-driven narration cues use.
    const input = {
      interviewId: "int-wrapup",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    interface SessionRef {
      sendTimeRemainingCue?: (text: string) => boolean;
    }
    let session: SessionRef = {};
    renderToStaticMarkup(
      <TestWrapper
        input={input}
        onRef={(ref) => {
          session = ref as SessionRef;
        }}
      />,
    );
    await flushMicrotasks();

    const mockClient = customGlobal.lastMockRealtimeClient;
    expect(mockClient?.sendNarrationCue).toBeDefined();
    expect(session.sendTimeRemainingCue).toBeDefined();

    const result = session.sendTimeRemainingCue?.(
      "[SYSTEM] One minute remaining. Wrap up the current topic naturally, then end the conversation cleanly.",
    );
    expect(result).toBe(true);
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(1);
    expect(mockClient?.sendNarrationCue.mock.calls[0][0]).toContain(
      "One minute remaining",
    );
    // Cue is tagged kind=`time_remaining` so structured logs can
    // distinguish wrap-up nudges from tool- and user-edit cues.
    expect(mockClient?.sendNarrationCue.mock.calls[0][1]).toEqual({
      kind: "time_remaining",
    });

    // A different cue text (15s warning) must NOT be dropped by dedup —
    // dedup keys on the full cue text, not just the kind.
    const result2 = session.sendTimeRemainingCue?.(
      "[SYSTEM] 15 seconds left. Finish your current sentence, thank the user, and call end_interview now.",
    );
    expect(result2).toBe(true);
    expect(mockClient?.sendNarrationCue).toHaveBeenCalledTimes(2);
    expect(mockClient?.sendNarrationCue.mock.calls[1][0]).toContain(
      "15 seconds left",
    );
  });

  it("treats an empty canvas snapshot as no recovery needed", async () => {
    const input = {
      interviewId: "int-123",
      interviewToken: "token-abc",
      ephemeralOpenAiToken: "token-oai",
    };

    mockFetch.mockImplementation((url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/canvas-snapshot")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ canvas: null, snapshotAt: null }),
        });
      }
      if (u.includes("/session-lock")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ holder: null, stale: false, status: "acquired" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderToStaticMarkup(<TestWrapper input={input} onRef={() => {}} />);
    await flushMicrotasks();

    // Empty snapshot — no restoration log should fire.
    const restoreLog = mockLogInfo.mock.calls.find(
      (c) => c[0] === "Restored canvas from snapshot",
    );
    expect(restoreLog).toBeUndefined();
  });
});
