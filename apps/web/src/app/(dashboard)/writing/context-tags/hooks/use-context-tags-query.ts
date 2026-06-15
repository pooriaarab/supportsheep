import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ContextTag } from "@repo/types";

async function fetchContextTags(): Promise<ContextTag[]> {
  const res = await fetch("/api/v1/context-tags");
  if (!res.ok) throw new Error("Failed to fetch context tags");
  const json = (await res.json()) as { data: ContextTag[] };
  return json.data;
}

async function createContextTag(
  data: Omit<ContextTag, "id" | "blogId" | "createdAt">,
): Promise<{ id: string }> {
  const res = await fetch("/api/v1/context-tags", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to create context tag");
  }
  return (await res.json()) as { id: string };
}

async function updateContextTag({
  id,
  ...data
}: { id: string } & Partial<
  Omit<ContextTag, "id" | "blogId" | "createdAt">
>): Promise<void> {
  const res = await fetch(`/api/v1/context-tags/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update context tag");
}

async function deleteContextTag(id: string): Promise<void> {
  const res = await fetch(`/api/v1/context-tags/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete context tag");
}

export function useContextTagsQuery() {
  return useQuery({
    queryKey: queryKeys.contextTags.lists(),
    queryFn: fetchContextTags,
  });
}

export function useCreateContextTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createContextTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contextTags.all });
    },
  });
}

export function useUpdateContextTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateContextTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contextTags.all });
    },
  });
}

export function useDeleteContextTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteContextTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contextTags.all });
    },
  });
}
