import { useQuery, type Query } from "@tanstack/react-query";

export interface InterviewCostBreakdown {
  realtimeCostUsd: number;
  writerCostUsd: number;
}

export interface InterviewCostData {
  /** Current interview status from Firestore — drives the StatusBadge. */
  status: string;
  /** ISO timestamp of `endedAt`, or null while the session is still active. */
  endedAt: string | null;
  /** ISO timestamp of `startedAt`, or null before connect. */
  startedAt: string | null;
  costUsd: number;
  realtimeTokens: number;
  writerTokens: number;
  durationSec: number;
  breakdown: InterviewCostBreakdown;
}

type CostQuery = Query<InterviewCostData, Error, InterviewCostData, readonly unknown[]>;

export interface UseInterviewCostOptions {
  enabled?: boolean;
  /**
   * Polling interval in ms, or a callback returning the next interval. The
   * callback form lets the consumer flip polling off automatically once the
   * session transitions out of `live` (TanStack Query re-evaluates on each
   * tick and a `false` return stops the timer).
   */
  refetchInterval?: number | ((query: CostQuery) => number | false);
}

export function useInterviewCost(interviewId: string, options?: UseInterviewCostOptions) {
  return useQuery<InterviewCostData, Error, InterviewCostData, readonly unknown[]>({
    queryKey: ["interview-cost", interviewId] as const,
    queryFn: async () => {
      if (!interviewId) throw new Error("No interview ID provided");
      const res = await fetch(`/api/v1/interviews/${interviewId}/cost`);
      if (!res.ok) throw new Error("Failed to fetch cost");
      return res.json() as Promise<InterviewCostData>;
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
