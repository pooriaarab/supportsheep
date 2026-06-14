import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { SitemapEntry } from "@repo/types";

type SitemapWithCount = SitemapEntry & { urlCount: number };

async function fetchSitemaps(): Promise<SitemapWithCount[]> {
  const res = await fetch("/api/v1/seo/sitemaps");
  if (!res.ok) throw new Error("Failed to fetch sitemaps");
  const json = (await res.json()) as { data: SitemapWithCount[] };
  return json.data;
}

async function createSitemap(
  url: string,
): Promise<{ id: string; urlCount: number }> {
  const res = await fetch("/api/v1/seo/sitemaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to import sitemap");
  }
  return (await res.json()) as { id: string; urlCount: number };
}

async function refreshSitemap(id: string): Promise<{ urlCount: number }> {
  const res = await fetch(`/api/v1/seo/sitemaps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh" }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error || "Failed to refresh sitemap");
  }
  return (await res.json()) as { urlCount: number };
}

async function deleteSitemap(id: string): Promise<void> {
  const res = await fetch(`/api/v1/seo/sitemaps/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete sitemap");
}

export function useSitemapsQuery() {
  return useQuery({
    queryKey: queryKeys.sitemaps.lists(),
    queryFn: fetchSitemaps,
  });
}

export function useCreateSitemapMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSitemap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sitemaps.all });
    },
  });
}

export function useRefreshSitemapMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshSitemap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sitemaps.all });
    },
  });
}

export function useDeleteSitemapMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSitemap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sitemaps.all });
    },
  });
}
