import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Article, ArticleStatus, PostType } from "@repo/types";

export interface PostListItem {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  postType: PostType;
  category: string;
  seoScore: number;
  author: string;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  submissionStatus?: Article["submissionStatus"];
  featuredImage?: { url: string; alt: string } | string | null;
}

interface PostsFilters {
  status?: ArticleStatus;
  category?: string;
  postType?: PostType;
  search?: string;
}

async function fetchPosts(filters?: PostsFilters): Promise<PostListItem[]> {
  const allPosts: PostListItem[] = [];
  let startAfter: string | undefined;
  const PAGE_SIZE = 100;

  // Paginate through all results
  while (true) {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.postType) params.set("postType", filters.postType);
    if (filters?.search) params.set("search", filters.search);
    if (startAfter) params.set("startAfter", startAfter);

    const res = await fetch(`/api/v1/articles?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Failed to fetch posts");
    }
    const json = (await res.json()) as {
      data: PostListItem[];
      pagination: { hasMore: boolean };
    };
    allPosts.push(...json.data);

    if (!json.pagination.hasMore || json.data.length === 0) break;
    startAfter = json.data[json.data.length - 1].id;
  }

  return allPosts;
}

async function createPost(
  data: Pick<Article, "title" | "postType" | "category">,
): Promise<{ id: string; slug: string }> {
  const res = await fetch("/api/v1/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("Failed to create post");
  }
  return (await res.json()) as { id: string; slug: string };
}

async function deletePosts(slugs: string[]): Promise<void> {
  const res = await fetch("/api/v1/articles/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugs }),
  });
  if (!res.ok) {
    throw new Error("Failed to delete posts");
  }
}

export function usePostsQuery(filters?: PostsFilters) {
  return useQuery({
    queryKey: queryKeys.articles.list(filters as Record<string, unknown>),
    queryFn: () => fetchPosts(filters),
  });
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useDeletePostsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePosts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}
