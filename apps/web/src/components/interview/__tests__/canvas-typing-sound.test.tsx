import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

interface CapturedAudio {
  ctx: { close: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> } | null;
  bufferSources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }>;
  mountCleanups: Array<() => void>;
}

let captured: CapturedAudio = { ctx: null, bufferSources: [], mountCleanups: [] };

// Capture each registered mount-effect; tests trigger them explicitly to
// emulate React mounting (avoids re-render loops that real SSR can't trigger).
const pendingEffects: Array<() => void | (() => void)> = [];
vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: (effect: () => void | (() => void)) => {
    pendingEffects.push(effect);
  },
}));

function runPendingEffects() {
  while (pendingEffects.length > 0) {
    const effect = pendingEffects.shift()!;
    const cleanup = effect();
    if (cleanup) captured.mountCleanups.push(cleanup);
  }
}

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function installWindow() {
  const storage: Record<string, string> = {};
  const win = {
    localStorage: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        for (const k of Object.keys(storage)) delete storage[k];
      },
      key: (i: number) => Object.keys(storage)[i] ?? null,
      length: 0,
    },
  } as unknown as Window & typeof globalThis;

  class MockAudioContext {
    destination = {};
    currentTime = 0;
    sampleRate = 48000;
    close = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockResolvedValue(undefined);
    createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
    createBuffer = (_c: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    });
    createBufferSource = () => {
      const src = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), buffer: null };
      captured.bufferSources.push(src);
      return src;
    };
    createBiquadFilter = () => ({
      type: "",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
    });
    constructor() {
      captured.ctx = this as unknown as CapturedAudio["ctx"];
    }
  }
  (win as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
  (globalThis as unknown as { window: Window }).window = win;
}

describe("CanvasTypingSound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    captured = { ctx: null, bufferSources: [], mountCleanups: [] };
    pendingEffects.length = 0;
    installWindow();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("renders an aria-labelled toggle button (muted by default)", async () => {
    const { CanvasTypingSound } = await import("../canvas-typing-sound");
    const html = renderToStaticMarkup(<CanvasTypingSound isAppending={false} />);
    expect(html).toContain("Unmute writing sound");
    expect(html).toContain('aria-pressed="false"');
  });

  it("does not create an AudioContext while muted (even when appending)", async () => {
    const { CanvasTypingSound } = await import("../canvas-typing-sound");
    renderToStaticMarkup(<CanvasTypingSound isAppending />);
    runPendingEffects();
    vi.advanceTimersByTime(500);
    expect(captured.ctx).toBeNull();
    expect(captured.bufferSources).toHaveLength(0);
  });

  it("plays clicks while appending + enabled, then stops on cleanup", async () => {
    // Pre-enable the preference so the component mounts with sound on.
    window.localStorage.setItem("interview:canvas-typing-sound-enabled", "1");
    const { CanvasTypingSound } = await import("../canvas-typing-sound");
    renderToStaticMarkup(<CanvasTypingSound isAppending />);
    runPendingEffects();

    vi.advanceTimersByTime(360);
    expect(captured.ctx).not.toBeNull();
    const clicksWhilePlaying = captured.bufferSources.length;
    expect(clicksWhilePlaying).toBeGreaterThan(0);
    expect(clicksWhilePlaying).toBeLessThanOrEqual(4); // ~120ms cadence

    // Cleanup the mount effect — equivalent to unmounting the component.
    captured.mountCleanups.forEach((fn) => fn());
    vi.advanceTimersByTime(500);
    // No new clicks after cleanup.
    expect(captured.bufferSources.length).toBe(clicksWhilePlaying);
    // AudioContext closed during cleanup.
    expect(captured.ctx?.close).toHaveBeenCalled();
  });
});
