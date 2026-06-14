import { describe, expect, it, vi, beforeEach } from "vitest";
import { aggregateUsage } from "./aggregate-usage";

// Mock the events repository (D1 path)
const mockListAllEvents = vi.hoisted(() => vi.fn());

vi.mock("./events-repository", () => ({
  listAllEvents: mockListAllEvents,
}));

describe("aggregateUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return zeros for empty events collection", async () => {
    mockListAllEvents.mockResolvedValue([]);

    const result = await aggregateUsage("default", "test-interview-id");
    expect(result).toEqual({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });
  });

  it("should aggregate realtime events (transcript_user, transcript_ai)", async () => {
    mockListAllEvents.mockResolvedValue([
      {
        id: "ev-1",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "transcript_user",
        ts: "2026-05-01T00:00:00.000Z",
        createdAt: 1,
        payload: {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        },
      },
      {
        id: "ev-2",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "transcript_ai",
        ts: "2026-05-01T00:00:00.001Z",
        createdAt: 2,
        payload: {
          usage: {
            input_tokens: 200,
            output_tokens: 150,
          },
        },
      },
      // Event without payload
      {
        id: "ev-3",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "transcript_user",
        ts: "2026-05-01T00:00:00.002Z",
        createdAt: 3,
        payload: {},
      },
      // Event with non-matching kind
      {
        id: "ev-4",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "other_event",
        ts: "2026-05-01T00:00:00.003Z",
        createdAt: 4,
        payload: {
          usage: {
            input_tokens: 999,
            output_tokens: 999,
          },
        },
      },
    ]);

    const result = await aggregateUsage("default", "test-interview-id");
    expect(result.realtime).toEqual({
      input: 300,
      output: 200,
    });
    expect(result.writer).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
    });
  });

  it("should aggregate writer events (writer_update) accounting for cached input tokens", async () => {
    mockListAllEvents.mockResolvedValue([
      {
        id: "ev-1",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "writer_update",
        ts: "2026-05-01T00:00:00.000Z",
        createdAt: 1,
        payload: {
          usage: {
            input_tokens: 1000,
            cache_read_input_tokens: 300,
            output_tokens: 500,
          },
        },
      },
      {
        id: "ev-2",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "writer_update",
        ts: "2026-05-01T00:00:00.001Z",
        createdAt: 2,
        payload: {
          usage: {
            input_tokens: 500,
            output_tokens: 200,
            // cache_read_input_tokens is omitted / undefined
          },
        },
      },
    ]);

    const result = await aggregateUsage("default", "test-interview-id");
    expect(result.realtime).toEqual({
      input: 0,
      output: 0,
    });
    expect(result.writer).toEqual({
      input: (1000 - 300) + 500, // 700 + 500 = 1200
      cachedInput: 300,
      output: 500 + 200, // 700
    });
  });

  it("should correctly aggregate a mix of realtime and writer events", async () => {
    mockListAllEvents.mockResolvedValue([
      {
        id: "ev-1",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "transcript_user",
        ts: "2026-05-01T00:00:00.000Z",
        createdAt: 1,
        payload: {
          usage: {
            input_tokens: 100,
            output_tokens: 20,
          },
        },
      },
      {
        id: "ev-2",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "writer_update",
        ts: "2026-05-01T00:00:00.001Z",
        createdAt: 2,
        payload: {
          usage: {
            input_tokens: 500,
            cache_read_input_tokens: 150,
            output_tokens: 100,
          },
        },
      },
      {
        id: "ev-3",
        blogId: "default",
        interviewId: "test-interview-id",
        kind: "transcript_ai",
        ts: "2026-05-01T00:00:00.002Z",
        createdAt: 3,
        payload: {
          usage: {
            input_tokens: 150,
            output_tokens: 80,
          },
        },
      },
    ]);

    const result = await aggregateUsage("default", "test-interview-id");
    expect(result).toEqual({
      realtime: {
        input: 250,
        output: 100,
      },
      writer: {
        input: 350,
        cachedInput: 150,
        output: 100,
      },
    });
  });
});
