import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { BlogConfig } from "@repo/types";

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch blog config");
  const json = await res.json();
  return json.data;
}

export function useBlogConfigQuery() {
  return useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });
}
