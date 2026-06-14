/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@tanstack/react-query";

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

import { useInterviewCost } from "./use-interview-cost-query";

describe("useInterviewCost hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("registers query correctly and fetches cost metrics", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewCost("mock-interview-123");

    expect(useQuery).toHaveBeenCalled();
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["interview-cost", "mock-interview-123"]);

    const mockData = {
      costUsd: 0.15,
      realtimeTokens: 1000,
      writerTokens: 2000,
      durationSec: 120,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await (queryCall as any).queryFn();
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/interviews/mock-interview-123/cost");
    expect(result).toEqual(mockData);
  });
});
