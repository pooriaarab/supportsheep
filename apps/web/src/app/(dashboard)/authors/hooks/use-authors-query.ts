import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Author } from "@repo/types";

export type AuthorInput = Omit<Author, "createdAt" | "updatedAt">;

async function fetchAuthors(): Promise<Author[]> {
  const res = await fetch("/api/v1/authors");
  if (!res.ok) {
    throw new Error("Failed to fetch authors");
  }
  const json = (await res.json()) as { data: Author[] };
  return json.data;
}

async function createAuthor(data: AuthorInput): Promise<Author> {
  const res = await fetch("/api/v1/authors", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to create author");
  }
  return (await res.json()) as Author;
}

async function updateAuthor(
  id: string,
  data: Partial<Omit<AuthorInput, "id">>,
): Promise<Author> {
  const res = await fetch(`/api/v1/authors/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: "" }))) as {
      error?: string;
    };
    throw new Error(err.error || "Failed to update author");
  }
  return (await res.json()) as Author;
}

async function deleteAuthor(id: string): Promise<void> {
  const res = await fetch(`/api/v1/authors/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete author");
  }
}

export function useAuthorsQuery() {
  return useQuery({
    queryKey: queryKeys.authors.lists(),
    queryFn: fetchAuthors,
  });
}

export function useCreateAuthorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAuthor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.authors.all });
    },
  });
}

export function useUpdateAuthorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<Omit<AuthorInput, "id">>) =>
      updateAuthor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.authors.all });
    },
  });
}

export function useDeleteAuthorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAuthor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.authors.all });
    },
  });
}
