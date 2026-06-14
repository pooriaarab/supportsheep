import { useQuery } from "@tanstack/react-query";

export interface InterviewEvent {
  id: string;
  kind: string;
  payload: unknown;
  ts: string;
}

export interface UseInterviewEventsOptions {
  enabled?: boolean;
  /**
   * Polling interval in ms, or `false` to disable polling. Fed straight to
   * TanStack Query's `refetchInterval`. Pass `false` (not `undefined`) to
   * explicitly stop polling — passing `undefined` leaves the underlying
   * query in its default no-poll mode.
   */
  refetchInterval?: number | false;
  /** Cap on events returned per fetch (server defaults to 20, max 100). */
  limit?: number;
}

/**
 * Fetch the events subcollection for an interview session. Admin-only on the
 * server (the route checks `role in {admin, editor, owner}`).
 *
 * The session-detail page uses this to render the chronological transcript
 * (transcript_user + transcript_ai), and the live polling interval keeps the
 * tab in sync with the running session without an SSE subscription.
 */
export function useInterviewEvents(
  interviewId: string,
  options?: UseInterviewEventsOptions,
) {
  return useQuery({
    queryKey: ["interview-events", interviewId, options?.limit ?? 100],
    queryFn: async () => {
      if (!interviewId) throw new Error("No interview ID provided");
      const limit = options?.limit ?? 100;
      const res = await fetch(
        `/api/v1/interviews/${interviewId}/events?limit=${limit}`,
      );
      if (!res.ok) throw new Error("Failed to fetch interview events");
      const json = (await res.json()) as { events: InterviewEvent[] };
      return json.events;
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
