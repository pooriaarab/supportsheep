import { useQuery } from "@tanstack/react-query";

const QUERY_KEY = ["interview-sessions"] as const;

export interface InterviewSessionSummary {
  id: string;
  status: string;
  topic: string | null;
  style: string | null;
  guestName: string | null;
  startedByUid: string | null;
  maxDurationSec: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

async function fetchInterviewSessions(): Promise<InterviewSessionSummary[]> {
  const res = await fetch("/api/v1/interviews");
  if (!res.ok) throw new Error("Failed to fetch interview sessions");
  const json = (await res.json()) as { data: InterviewSessionSummary[] };
  return json.data;
}

export function useInterviewSessionsQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchInterviewSessions });
}
