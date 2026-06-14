import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DurationTimer } from "../duration-timer";

let mockElapsed = 0;
const mockSetState = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn((init) => {
      if (init === 0) {
        return [mockElapsed, (updater: unknown) => {
          mockElapsed = typeof updater === "function" ? (updater as (prev: number) => number)(mockElapsed) : (updater as number);
          mockSetState(mockElapsed);
        }];
      }
      return [init, vi.fn()];
    }),
  };
});

// Mock useMountEffect to run immediately in tests
vi.mock("@/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn((effect) => {
    effect();
  }),
}));

describe("DurationTimer", () => {
  beforeEach(() => {
    mockElapsed = 0;
    mockSetState.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial remaining time correctly", () => {
    // 300 seconds is 5 minutes (05:00)
    const html = renderToStaticMarkup(<DurationTimer maxDurationSeconds={300} />);
    expect(html).toContain("05:00");
    expect(html).not.toContain("animate-pulse"); // not low time yet
  });

  it("applies animate-pulse classes when remaining time is low (<=10%)", () => {
    mockElapsed = 275; // 25s remaining out of 300s (<= 10%)

    const html = renderToStaticMarkup(<DurationTimer maxDurationSeconds={300} />);
    expect(html).toContain("00:25");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("text-destructive");
  });

  it("triggers warning and cap callbacks as elapsed time advances", () => {
    vi.useFakeTimers();

    const onWarning = vi.fn();
    const onCap = vi.fn();

    // Capture the setInterval callback
    let intervalCallback: (() => void) | null = null;
    vi.spyOn(global, "setInterval").mockImplementation((cb) => {
      intervalCallback = cb as () => void;
      return 123 as unknown as NodeJS.Timeout;
    });

    renderToStaticMarkup(<DurationTimer maxDurationSeconds={100} onWarning={onWarning} onCap={onCap} />);

    expect(global.setInterval).toHaveBeenCalled();
    expect(intervalCallback).not.toBeNull();

    // Trigger tick up to 89s -> no warning yet
    for (let i = 0; i < 89; i++) {
      if (intervalCallback) {
        intervalCallback();
      }
    }
    expect(onWarning).not.toHaveBeenCalled();

    // Tick 90s -> triggers warning (90%)
    if (intervalCallback) {
      intervalCallback();
    }
    expect(onWarning).toHaveBeenCalled();
    expect(onCap).not.toHaveBeenCalled();

    // Tick up to 99s -> no cap yet
    for (let i = 0; i < 9; i++) {
      if (intervalCallback) {
        intervalCallback();
      }
    }
    expect(onCap).not.toHaveBeenCalled();

    // Tick 100s -> triggers cap (100%)
    if (intervalCallback) {
      intervalCallback();
    }
    expect(onCap).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("fires the 60s-remaining wrap-up nudge exactly once at 60s remaining (W24L)", () => {
    // Regression guard for the UX bug where the AI was cut off mid-sentence
    // at the cap. The timer must nudge the AI to wrap up gracefully as the
    // cap approaches; the consumer wires the cue dispatcher into this
    // callback. Locked to a single fire so the realtime channel isn't
    // flooded with duplicate cues from a slow interval tick.
    vi.useFakeTimers();

    const onOneMinuteWarning = vi.fn();

    // Capture the *second* setInterval callback — the side-effect tick.
    // The first is the elapsed counter (pure state updater); the second
    // is the threshold checker that fires the callbacks.
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(global, "setInterval").mockImplementation((cb) => {
      intervalCallbacks.push(cb as () => void);
      return 123 as unknown as NodeJS.Timeout;
    });

    renderToStaticMarkup(
      <DurationTimer
        maxDurationSeconds={300}
        onOneMinuteWarning={onOneMinuteWarning}
      />,
    );

    const sideEffectTick = intervalCallbacks[1];
    expect(sideEffectTick).toBeDefined();

    // Tick to 239s (1s before the 60s-remaining threshold for a 300s cap).
    for (let i = 0; i < 239; i++) {
      sideEffectTick?.();
    }
    expect(onOneMinuteWarning).not.toHaveBeenCalled();

    // Tick 240s — exactly 60s remain. Cue fires once.
    sideEffectTick?.();
    expect(onOneMinuteWarning).toHaveBeenCalledTimes(1);

    // Subsequent ticks must NOT re-fire — flooded cues would push the AI
    // off-script with conflicting wrap-up nudges.
    for (let i = 0; i < 10; i++) {
      sideEffectTick?.();
    }
    expect(onOneMinuteWarning).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("fires the 15s-remaining final wrap-up nudge exactly once at 15s remaining (W24L)", () => {
    vi.useFakeTimers();

    const onFinalWarning = vi.fn();

    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(global, "setInterval").mockImplementation((cb) => {
      intervalCallbacks.push(cb as () => void);
      return 123 as unknown as NodeJS.Timeout;
    });

    renderToStaticMarkup(
      <DurationTimer
        maxDurationSeconds={300}
        onFinalWarning={onFinalWarning}
      />,
    );

    const sideEffectTick = intervalCallbacks[1];
    expect(sideEffectTick).toBeDefined();

    // Tick to 284s (1s before the 15s-remaining threshold for a 300s cap).
    for (let i = 0; i < 284; i++) {
      sideEffectTick?.();
    }
    expect(onFinalWarning).not.toHaveBeenCalled();

    // Tick 285s — exactly 15s remain. Cue fires once.
    sideEffectTick?.();
    expect(onFinalWarning).toHaveBeenCalledTimes(1);

    // Subsequent ticks must NOT re-fire.
    for (let i = 0; i < 10; i++) {
      sideEffectTick?.();
    }
    expect(onFinalWarning).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("skips the wrap-up nudges entirely when the configured duration is too short to make them meaningful", () => {
    // A 30s test session should not fire the 60s nudge at negative
    // elapsed time. Locks down the lower bound so a future short-call
    // experiment doesn't spam the realtime channel with cues that don't
    // make temporal sense.
    vi.useFakeTimers();

    const onOneMinuteWarning = vi.fn();
    const onFinalWarning = vi.fn();

    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(global, "setInterval").mockImplementation((cb) => {
      intervalCallbacks.push(cb as () => void);
      return 123 as unknown as NodeJS.Timeout;
    });

    renderToStaticMarkup(
      <DurationTimer
        maxDurationSeconds={10}
        onOneMinuteWarning={onOneMinuteWarning}
        onFinalWarning={onFinalWarning}
      />,
    );

    const sideEffectTick = intervalCallbacks[1];
    // Burn through the whole call.
    for (let i = 0; i < 12; i++) {
      sideEffectTick?.();
    }
    expect(onOneMinuteWarning).not.toHaveBeenCalled();
    expect(onFinalWarning).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
