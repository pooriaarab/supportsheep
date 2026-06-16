import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { InternalLinkRule } from "@repo/types";

async function fetchInternalLinkRules(): Promise<InternalLinkRule[]> {
  const res = await fetch("/api/v1/seo/internal-links");
  if (!res.ok) throw new Error("Failed to fetch internal link rules");
  const json = (await res.json()) as { data: InternalLinkRule[] };
  return json.data;
}

async function createInternalLinkRule(
  data: Omit<InternalLinkRule, "id" | "blogId">,
): Promise<{ id: string }> {
  const res = await fetch("/api/v1/seo/internal-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to create rule");
  }
  return (await res.json()) as { id: string };
}

async function updateInternalLinkRule({
  id,
  ...data
}: { id: string } & Partial<
  Omit<InternalLinkRule, "id" | "blogId">
>): Promise<void> {
  const res = await fetch(
    `/api/v1/seo/internal-links/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error("Failed to update rule");
}

async function deleteInternalLinkRule(id: string): Promise<void> {
  const res = await fetch(
    `/api/v1/seo/internal-links/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete rule");
}

export function useInternalLinkRulesQuery() {
  return useQuery({
    queryKey: queryKeys.internalLinkRules.lists(),
    queryFn: fetchInternalLinkRules,
  });
}

export function useCreateInternalLinkRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInternalLinkRule,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internalLinkRules.all,
      });
    },
  });
}

export function useUpdateInternalLinkRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInternalLinkRule,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internalLinkRules.all,
      });
    },
  });
}

export function useDeleteInternalLinkRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInternalLinkRule,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internalLinkRules.all,
      });
    },
  });
}

