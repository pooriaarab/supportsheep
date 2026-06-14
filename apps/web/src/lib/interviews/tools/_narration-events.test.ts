import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAppendEvents = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

import {
  emitFireAndForgetCompletion,
  emitToolInFlightEvent,
  emitToolResultEvent,
} from "./_narration-events";

/** Extract the single event passed to the most recent `appendEvents` call. */
function lastEvent(): { kind: string; payload: Record<string, unknown> } {
  const call = mockAppendEvents.mock.calls.at(-1);
  const events = call?.[2] as Array<{
    kind: string;
    payload: Record<string, unknown>;
  }>;
  return events[0];
}

describe("narration event emitters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a tool_result event for a successful sync tool with the summary the AI can narrate", async () => {
    await emitToolResultEvent("int-1", "set_title", "call-1", {
      ok: true,
      summary: "title_set",
    });
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const payload = lastEvent();
    expect(payload.kind).toBe("tool_result");
    expect(payload.payload).toMatchObject({
      toolName: "set_title",
      callId: "call-1",
      ok: true,
      summary: "title_set",
    });
  });

  it("emits a tool_result event with errorKind+message for failed sync tools so the AI knows to acknowledge", async () => {
    await emitToolResultEvent("int-2", "delete_section", "call-2", {
      ok: false,
      category: "not-found",
      message: "Section sec-x not found",
    });
    const payload = lastEvent();
    expect(payload.kind).toBe("tool_result");
    expect(payload.payload).toMatchObject({
      toolName: "delete_section",
      ok: false,
      errorKind: "not-found",
      message: "Section sec-x not found",
    });
  });

  it("emits a tool_in_flight event so the AI tells the user about background work upfront", async () => {
    await emitToolInFlightEvent("int-3", "request_featured_image", "call-3");
    const payload = lastEvent();
    expect(payload.kind).toBe("tool_in_flight");
    expect(payload.payload).toMatchObject({
      toolName: "request_featured_image",
      callId: "call-3",
    });
  });

  it("emits a tool_completed event so the AI can announce a fire-and-forget result has landed", async () => {
    await emitFireAndForgetCompletion("int-4", "request_featured_image", {
      ok: true,
      summary: "featured_image_ready",
    });
    const payload = lastEvent();
    expect(payload.kind).toBe("tool_completed");
    expect(payload.payload).toMatchObject({
      toolName: "request_featured_image",
      ok: true,
      summary: "featured_image_ready",
    });
  });

  it("emits a tool_completed event with the failure message when the background work errors", async () => {
    await emitFireAndForgetCompletion("int-5", "request_seo_score", {
      ok: false,
      message: "Anthropic 503",
    });
    const payload = lastEvent();
    expect(payload.kind).toBe("tool_completed");
    expect(payload.payload).toMatchObject({
      toolName: "request_seo_score",
      ok: false,
      message: "Anthropic 503",
    });
  });

  it("never throws when the event write fails — narration is best-effort", async () => {
    mockAppendEvents.mockRejectedValueOnce(new Error("d1 down"));
    await expect(
      emitToolResultEvent("int-6", "set_title", undefined, {
        ok: true,
        summary: "ok",
      }),
    ).resolves.toBeUndefined();
  });
});
