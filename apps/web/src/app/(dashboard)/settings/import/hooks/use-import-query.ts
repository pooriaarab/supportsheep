/**
 * TanStack Query hooks for the WordPress import feature
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ImportJob } from "@repo/types";

async function uploadWordPressFile(
  file: File,
): Promise<{ id: string; totalPosts: number; message: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/v1/import/wordpress", {
    method: "Article",
    body: formData,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Import failed");
  }

  return res.json();
}

async function fetchImportJob(id: string): Promise<ImportJob> {
  const res = await fetch(
    `/api/v1/import/wordpress?id=${encodeURIComponent(id)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch import status");
  const json = await res.json();
  return json.data;
}

async function cancelImportJob(id: string): Promise<void> {
  const res = await fetch("/api/v1/import/wordpress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status: "failed" }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to cancel import");
  }
}

async function fetchImports(): Promise<ImportJob[]> {
  const res = await fetch("/api/v1/import/wordpress");
  if (!res.ok) throw new Error("Failed to fetch imports");
  const json = await res.json();
  return json.data;
}

export function useImportsQuery() {
  return useQuery({
    queryKey: queryKeys.imports.lists(),
    queryFn: fetchImports,
  });
}

export function useImportJobQuery(id: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: id ? queryKeys.imports.detail(id) : queryKeys.imports.all,
    queryFn: () => (id ? fetchImportJob(id) : Promise.reject("No ID")),
    enabled: !!id,
    refetchInterval: (query) => {
      const prev = query.state.data?.status;
      // Poll while running, stop when completed/failed
      if (prev === "running" || prev === "pending") return 3000;

      // When the import finishes, refresh the history list and articles
      if (prev === "completed" || prev === "failed") {
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.lists() });
        queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      }
      return false;
    },
  });
}

export function useCancelImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelImportJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.all });
    },
  });
}

export function useWordPressImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadWordPressFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.imports.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}
