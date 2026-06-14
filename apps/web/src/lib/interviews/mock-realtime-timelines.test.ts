import { describe, expect, it } from "vitest";
import {
  getMockRealtimeTimeline,
  getMockRealtimeTimelineDurationMs,
  type MockTimelineEvent,
} from "./mock-realtime-timelines";

function isMonotonic(events: MockTimelineEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    if (events[i].delayMs < events[i - 1].delayMs) return false;
  }
  return true;
}

describe("getMockRealtimeTimeline", () => {
  it("returns the basic timeline starting at delayMs=0 and ending with idle", () => {
    const events = getMockRealtimeTimeline("basic");
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].delayMs).toBe(0);
    expect(events[events.length - 1].kind).toBe("idle");
  });

  it("returns the comprehensive timeline ending with idle", () => {
    const events = getMockRealtimeTimeline("comprehensive");
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].kind).toBe("idle");
  });

  it("orders events monotonically by delayMs in both modes", () => {
    expect(isMonotonic(getMockRealtimeTimeline("basic"))).toBe(true);
    expect(isMonotonic(getMockRealtimeTimeline("comprehensive"))).toBe(true);
  });

  it("returns a fresh copy each call so callers cannot mutate the source", () => {
    const a = getMockRealtimeTimeline("basic");
    const b = getMockRealtimeTimeline("basic");
    expect(a).not.toBe(b);
    a.length = 0;
    expect(getMockRealtimeTimeline("basic").length).toBeGreaterThan(0);
  });

  it("basic timeline emits exactly 4 tool calls", () => {
    const events = getMockRealtimeTimeline("basic");
    const toolCalls = events.filter((e) => e.kind === "tool_call");
    expect(toolCalls.length).toBe(4);
  });

  it("comprehensive timeline emits 12 tool calls covering distinct categories", () => {
    const events = getMockRealtimeTimeline("comprehensive");
    const toolCalls = events.filter((e) => e.kind === "tool_call");
    expect(toolCalls.length).toBe(12);
    // Sanity-check that we touched every category the realtime surface exposes.
    const names = new Set(toolCalls.map((e) => (e.kind === "tool_call" ? e.name : "")));
    expect(names.has("set_title")).toBe(true);
    expect(names.has("insert_section")).toBe(true);
    expect(names.has("insert_paragraph")).toBe(true);
    expect(names.has("apply_bold")).toBe(true);
    expect(names.has("embed_youtube")).toBe(true);
    expect(names.has("set_seo_meta")).toBe(true);
    expect(names.has("finalize_section")).toBe(true);
  });

  it("includes the standard conversation lifecycle in both timelines", () => {
    for (const mode of ["basic", "comprehensive"] as const) {
      const types = new Set(
        getMockRealtimeTimeline(mode)
          .filter((e) => e.kind === "conversation_state")
          .map((e) => (e.kind === "conversation_state" ? e.type : "")),
      );
      expect(types.has("input_audio_buffer.speech_started")).toBe(true);
      expect(types.has("input_audio_buffer.committed")).toBe(true);
      expect(types.has("response.created")).toBe(true);
      expect(types.has("response.audio.delta")).toBe(true);
      expect(types.has("response.done")).toBe(true);
    }
  });
});

describe("getMockRealtimeTimelineDurationMs", () => {
  it("basic timeline runs under ~35s wall-clock", () => {
    const duration = getMockRealtimeTimelineDurationMs("basic");
    expect(duration).toBeGreaterThan(20_000);
    expect(duration).toBeLessThan(35_000);
  });

  it("comprehensive timeline runs under ~60s wall-clock", () => {
    const duration = getMockRealtimeTimelineDurationMs("comprehensive");
    expect(duration).toBeGreaterThan(45_000);
    expect(duration).toBeLessThan(65_000);
  });
});
