/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

import { useInterviewEvents } from "./use-interview-events-query";

describe("useInterviewEvents hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("registers query with the correct key + URL and unwraps the events array", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewEvents("mock-int-1", { limit: 50, refetchInterval: 5000 });

    expect(useQuery).toHaveBeenCalled();
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["interview-events", "mock-int-1", 50]);
    expect(queryCall.refetchInterval).toBe(5000);

    const apiResponse = {
      events: [
        { id: "e1", kind: "transcript_user", payload: { text: "hi" }, ts: "2026-05-22T10:00:00Z" },
        { id: "e2", kind: "transcript_ai", payload: { text: "hello" }, ts: "2026-05-22T10:00:01Z" },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => apiResponse,
    });

    const events = await (queryCall as any).queryFn();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/interviews/mock-int-1/events?limit=50",
    );
    expect(events).toEqual(apiResponse.events);
  });

  it("defaults limit to 100 and passes refetchInterval=false straight through", () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewEvents("mock-int-2", { refetchInterval: false });

    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["interview-events", "mock-int-2", 100]);
    expect(queryCall.refetchInterval).toBe(false);
  });

  it("rejects when interviewId is empty", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewEvents("");
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];

    await expect((queryCall as any).queryFn()).rejects.toThrow(/No interview ID/);
  });

  it("throws when the fetch returns a non-OK response", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewEvents("mock-int-3");
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];

    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    await expect((queryCall as any).queryFn()).rejects.toThrow(
      /Failed to fetch interview events/,
    );
  });
});
