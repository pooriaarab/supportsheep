import { useQuery } from "@tanstack/react-query";

export interface InterviewCostSummary {
  thisMonth: {
    totalUsd: number;
    totalInterviews: number;
    capUsd: number | null;
    capUtilizationPct: number | null;
  };
  byDay: Array<{ date: string; costUsd: number; interviews: number }>;
  byMonth: Array<{ month: string; costUsd: number; interviews: number }>;
}

export interface UseInterviewCostSummaryOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useInterviewCostSummary(options?: UseInterviewCostSummaryOptions) {
  return useQuery({
    queryKey: ["interview-cost-summary"],
    queryFn: async () => {
      const res = await fetch("/api/v1/interviews/cost/summary");
      if (!res.ok) throw new Error("Failed to fetch cost summary");
      return res.json() as Promise<InterviewCostSummary>;
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
