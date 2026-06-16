import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export interface CategoryItem {
  slug: string;
  displayName: string;
  order: number;
  icon: string;
  description: string;
  postCount: number;
}

async function fetchCategories(): Promise<CategoryItem[]> {
  const res = await fetch("/api/v1/categories");
  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }
  const json = (await res.json()) as { data: CategoryItem[] };
  return json.data;
}

async function createCategory(
  data: Pick<CategoryItem, "slug" | "displayName" | "icon" | "description">,
): Promise<CategoryItem> {
  const res = await fetch("/api/v1/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to create category");
  }
  return (await res.json()) as CategoryItem;
}

async function updateCategory(
  slug: string,
  data: Partial<Pick<CategoryItem, "displayName" | "icon" | "description">>,
): Promise<CategoryItem> {
  const res = await fetch(`/api/v1/categories/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to update category");
  }
  return (await res.json()) as CategoryItem;
}

async function deleteCategory(slug: string): Promise<void> {
  const res = await fetch(`/api/v1/categories/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete category");
  }
}

async function reorderCategories(order: Record<string, number>): Promise<void> {
  const res = await fetch("/api/v1/categories/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) {
    throw new Error("Failed to reorder categories");
  }
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.lists(),
    queryFn: fetchCategories,
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      ...data
    }: { slug: string } & Partial<
      Pick<CategoryItem, "displayName" | "icon" | "description">
    >) => updateCategory(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useReorderCategoriesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}
