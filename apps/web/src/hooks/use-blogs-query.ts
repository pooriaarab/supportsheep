import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export interface BlogSummary {
  id: string;
  slug: string;
  displayName: string;
  role: string;
}

export interface BlogsResult {
  blogs: BlogSummary[];
  activeBlogId: string | null;
}

async function fetchBlogs(): Promise<BlogsResult> {
  const res = await fetch("/api/v1/blogs");
  if (!res.ok) throw new Error("Failed to fetch blogs");
  const json = (await res.json()) as {
    data: BlogSummary[];
    activeBlogId: string | null;
  };
  return { blogs: json.data, activeBlogId: json.activeBlogId };
}

async function setActiveBlog(blogId: string): Promise<void> {
  const res = await fetch("/api/v1/blogs/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blogId }),
  });
  if (!res.ok) throw new Error("Failed to switch blog");
}

/** the knowledge bases the signed-in user is a member of, with their per-blog role. */
export function useBlogsQuery() {
  return useQuery({
    queryKey: queryKeys.blogs.lists(),
    queryFn: fetchBlogs,
  });
}

/**
 * Switch the active knowledge base. Sets the `bb_active_blog` cookie server-side (after
 * re-verifying membership), then the caller refreshes so server components
 * re-resolve the tenant.
 */
export function useSetActiveBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setActiveBlog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all });
    },
  });
}
