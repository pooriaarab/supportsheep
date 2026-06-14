/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@tanstack/react-query";

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

import { useInterviewCostSummary } from "./use-interview-cost-summary";

describe("useInterviewCostSummary hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("registers query correctly and fetches cost summary metrics", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: null, isLoading: true } as any);

    useInterviewCostSummary();

    expect(useQuery).toHaveBeenCalled();
    const queryCall = vi.mocked(useQuery).mock.calls[0][0];
    expect(queryCall.queryKey).toEqual(["interview-cost-summary"]);

    const mockSummary = {
      thisMonth: { totalUsd: 1.5, totalInterviews: 2, capUsd: 100, capUtilizationPct: 1.5 },
      byDay: [{ date: "2026-05-20", costUsd: 1.5, interviews: 2 }],
      byMonth: [{ month: "2026-05", costUsd: 1.5, interviews: 2 }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    });

    const result = await (queryCall as any).queryFn();
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/interviews/cost/summary");
    expect(result).toEqual(mockSummary);
  });
});
