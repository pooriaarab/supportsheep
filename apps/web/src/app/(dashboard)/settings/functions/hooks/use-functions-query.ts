/**
 * TanStack Query hooks for the Functions dashboard
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface FunctionLog {
  id: string;
  function: string;
  status: string;
  executedAt: string | null;
  [key: string]: unknown;
}

export interface CloudFunction {
  name: string;
  description: string;
  schedule: string;
  lastRunAt: string | null;
  lastStatus: string;
  recentLogs: FunctionLog[];
}

async function fetchFunctions(): Promise<CloudFunction[]> {
  const res = await fetch("/api/v1/functions");
  if (!res.ok) throw new Error("Failed to fetch functions");
  const json = await res.json();
  return json.data;
}

async function triggerFunction(functionName: string): Promise<void> {
  const res = await fetch("/api/v1/functions", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ functionName }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to trigger function");
  }
}

export function useFunctionsQuery() {
  return useQuery({
    queryKey: queryKeys.functions.lists(),
    queryFn: fetchFunctions,
    refetchInterval: 30_000,
  });
}

export function useTriggerFunctionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerFunction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.functions.all });
    },
  });
}
