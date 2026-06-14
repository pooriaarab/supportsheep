import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { WritingSkill } from "@repo/types";

async function fetchWritingSkills(): Promise<WritingSkill[]> {
  const res = await fetch("/api/v1/writing-skills");
  if (!res.ok) throw new Error("Failed to fetch writing skills");
  const json = (await res.json()) as { data: WritingSkill[] };
  return json.data;
}

async function createWritingSkill(
  data: Omit<WritingSkill, "id" | "blogId" | "type" | "order">,
): Promise<{ id: string }> {
  const res = await fetch("/api/v1/writing-skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to create writing skill");
  }
  return (await res.json()) as { id: string };
}

async function updateWritingSkill({
  id,
  ...data
}: { id: string } & Partial<
  Omit<WritingSkill, "id" | "blogId" | "type" | "order">
>): Promise<void> {
  const res = await fetch(`/api/v1/writing-skills/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update writing skill");
}

async function deleteWritingSkill(id: string): Promise<void> {
  const res = await fetch(`/api/v1/writing-skills/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete writing skill");
}

async function reorderWritingSkills(
  order: Record<string, number>,
): Promise<void> {
  const res = await fetch("/api/v1/writing-skills/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error("Failed to reorder writing skills");
}

async function runSkillsPipeline(
  content: string,
  skillIds: string[],
): Promise<string> {
  const res = await fetch("/api/v1/writing-skills/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, skillIds }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to run skills pipeline");
  }
  const json = (await res.json()) as { data: { content: string } };
  return json.data.content;
}

export function useWritingSkillsQuery() {
  return useQuery({
    queryKey: queryKeys.writingSkills.lists(),
    queryFn: fetchWritingSkills,
  });
}

export function useCreateWritingSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWritingSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.writingSkills.all,
      });
    },
  });
}

export function useUpdateWritingSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWritingSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.writingSkills.all,
      });
    },
  });
}

export function useDeleteWritingSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWritingSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.writingSkills.all,
      });
    },
  });
}

export function useReorderWritingSkillsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderWritingSkills,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.writingSkills.all,
      });
    },
  });
}

export function useRunSkillsPipelineMutation() {
  return useMutation({
    mutationFn: ({
      content,
      skillIds,
    }: {
      content: string;
      skillIds: string[];
    }) => runSkillsPipeline(content, skillIds),
  });
}
