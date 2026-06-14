"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@repo/ui/utils";

const STATUS_COLORS: Record<string, string> = {
  published: "bg-success",
  scheduled: "bg-warning",
  draft: "bg-muted-foreground/50",
  archived: "bg-destructive/50",
};

interface RecentPost {
  slug: string;
  title: string;
  status: string;
}

export function SidebarRecentPosts({ collapsed }: { collapsed?: boolean }) {
  const { data } = useQuery({
    queryKey: queryKeys.articles.list({ limit: 20 }),
    queryFn: async () => {
      const res = await fetch(
        "/api/v1/articles?limit=20&orderBy=updatedAt&orderDir=desc",
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: RecentPost[] };
      return json.data ?? [];
    },
    staleTime: 30_000,
  });

  const posts = data ?? [];
  if (collapsed || posts.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        Recent Posts
      </p>
      <div className="max-h-[40vh] overflow-y-auto space-y-0.5">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/posts/${post.slug}/edit`}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span
              className={cn(
                "size-2 rounded-full shrink-0",
                STATUS_COLORS[post.status] ?? STATUS_COLORS.draft,
              )}
            />
            <span className="truncate">{post.title}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/posts"
        className="block px-2 py-1.5 mt-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        View all posts
      </Link>
    </div>
  );
}
