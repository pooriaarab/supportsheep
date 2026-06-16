"use client";

import { useMemo } from "react";
import {
  FileText,
  Pencil,
  Clock,
  Search,
  ArrowRight,
  Plus,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/ui/layout/page-shell";
import { StatGrid } from "@/components/shared/stat-grid";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Badge } from "@repo/ui/primitives/badge";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { EmptyState } from "@repo/ui/composites/empty-state";

const PublishingActivityChart = dynamic(
  () => import("./charts").then((mod) => mod.PublishingActivityChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

const PostsByCategoryChart = dynamic(
  () => import("./charts").then((mod) => mod.PostsByCategoryChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

const SeoDistributionChart = dynamic(
  () => import("./charts").then((mod) => mod.SeoDistributionChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

interface Article {
  id: string;
  slug: string;
  title: string;
  status: string;
  category: string;
  seoScore: number;
  wordCount: number;
  updatedAt: string | { _seconds: number };
  publishedAt: string | { _seconds: number } | null;
  createdAt: string | { _seconds: number };
}

interface Category {
  id: string;
  slug: string;
  displayName: string;
}

async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/v1/articles?limit=100");
  if (!res.ok) throw new Error("Failed to fetch articles");
  const json = await res.json();
  return json.data ?? [];
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/v1/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const json = await res.json();
  return json.data ?? [];
}

function parseTimestamp(
  ts: string | { _seconds: number } | null | undefined,
): Date | null {
  if (!ts) return null;
  if (typeof ts === "string") return new Date(ts);
  if (typeof ts === "object" && "_seconds" in ts)
    return new Date(ts._seconds * 1000);
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  archived: "bg-warning/10 text-warning",
};

export default function DashboardPage() {
  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["dashboard-articles"],
    queryFn: fetchArticles,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["dashboard-categories"],
    queryFn: fetchCategories,
  });

  const isLoading = articlesLoading || categoriesLoading;

  const stats = useMemo(() => {
    const counts = articles.reduce(
      (acc, article) => {
        if (article.status === "published") {
          acc.published += 1;
          if (typeof article.seoScore === "number") {
            acc.seoTotal += article.seoScore;
            acc.seoCount += 1;
          }
        } else if (article.status === "draft") {
          acc.drafts += 1;
        } else if (article.status === "scheduled") {
          acc.scheduled += 1;
        }
        return acc;
      },
      { published: 0, drafts: 0, scheduled: 0, seoTotal: 0, seoCount: 0 },
    );
    const avgSeo =
      counts.seoCount > 0 ? Math.round(counts.seoTotal / counts.seoCount) : 0;

    return {
      published: counts.published,
      drafts: counts.drafts,
      scheduled: counts.scheduled,
      avgSeo,
    };
  }, [articles]);

  const recentPosts = useMemo(() => {
    return articles
      .toSorted((a, b) => {
        const da = parseTimestamp(a.updatedAt)?.getTime() ?? 0;
        const db = parseTimestamp(b.updatedAt)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 10);
  }, [articles]);

  const weeklyActivity = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = articles.filter((a) => {
        const d = parseTimestamp(a.publishedAt ?? a.createdAt);
        return d && d >= weekStart && d < weekEnd;
      }).length;
      const label = `W${8 - i}`;
      weeks.push({ label, count });
    }
    return weeks;
  }, [articles]);

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      const cat = a.category || "uncategorized";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([slug, count]) => {
        const cat = categories.find((c) => c.slug === slug);
        return { name: cat?.displayName ?? slug, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [articles, categories]);

  const seoDistribution = useMemo(() => {
    const buckets = [
      { label: "Needs Work (0-50)", count: 0, range: [0, 50] },
      { label: "Fair (50-70)", count: 0, range: [50, 70] },
      { label: "Good (70-90)", count: 0, range: [70, 90] },
      { label: "Excellent (90+)", count: 0, range: [90, 101] },
    ];
    for (const a of articles) {
      const score = a.seoScore ?? 0;
      for (const bucket of buckets) {
        if (score >= bucket.range[0] && score < bucket.range[1]) {
          bucket.count++;
          break;
        }
      }
    }
    return buckets;
  }, [articles]);

  const quickActions = [
    { label: "New Article", href: "/posts?new=true", icon: Plus },
    {
      label: "Generate from Keyword",
      href: "/generate/keyword",
      icon: Sparkles,
    },
    { label: "Categories", href: "/categories", icon: FolderOpen },
    { label: "SEO Analytics", href: "/seo/analytics", icon: Search },
  ];

  return (
    <PageShell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-6">
        <h1 className="sr-only">Dashboard</h1>
        {/* Stats */}
        <StatGrid columns={4}>
          <StatCard
            label="Published Articles"
            value={stats.published}
            icon={FileText}
            loading={isLoading}
          />
          <StatCard
            label="Draft Articles"
            value={stats.drafts}
            icon={Pencil}
            loading={isLoading}
          />
          <StatCard
            label="Scheduled"
            value={stats.scheduled}
            icon={Clock}
            loading={isLoading}
          />
          <StatCard
            label="Avg SEO Score"
            value={stats.avgSeo}
            icon={Search}
            subtitle={
              stats.avgSeo >= 70
                ? "Good"
                : stats.avgSeo >= 50
                  ? "Fair"
                  : "Needs improvement"
            }
            loading={isLoading}
          />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Articles */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Articles
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/posts">
                  View All
                  <ArrowRight className="size-3 ml-1" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-3" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentPosts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={FileText}
                title="No Articles Yet"
                description="Create your first article to start publishing."
                action={{ label: "New Article", href: "/posts?new=true" }}
              />
            ) : (
              <ul className="space-y-0">
                {recentPosts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.slug}/edit`}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-b-0 -mx-2 px-2 rounded-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {post.wordCount
                            ? `${post.wordCount.toLocaleString()} words`
                            : "No content"}{" "}
                          &middot; SEO {post.seoScore ?? 0}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] shrink-0 ${STATUS_COLORS[post.status] ?? ""}`}
                      >
                        {post.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Quick Actions
            </h2>
            <nav aria-label="Quick actions" className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex items-center gap-3 p-3 rounded-lg border border-border transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <action.icon
                      className="size-4 text-foreground group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {action.label}
                  </span>
                  <ArrowRight
                    className="size-3.5 text-muted-foreground ml-auto opacity-0 -translate-x-1 transition-[opacity,transform] group-hover:opacity-100 group-hover:translate-x-0 motion-reduce:transition-none motion-reduce:translate-x-0"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </nav>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Publishing Activity */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Publishing Activity (Last 8 Weeks)
            </h2>
            {isLoading ? (
              <Skeleton className="h-48 w-full" aria-hidden="true" />
            ) : (
              <PublishingActivityChart data={weeklyActivity} />
            )}
          </Card>

          {/* Articles by Category */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Articles by Category
            </h2>
            {isLoading ? (
              <Skeleton className="h-48 w-full" aria-hidden="true" />
            ) : categoryData.length === 0 ? (
              <EmptyState
                size="sm"
                icon={FolderOpen}
                title="No Category Data"
                description="Assign categories to articles to see the breakdown."
              />
            ) : (
              <PostsByCategoryChart data={categoryData} />
            )}
          </Card>
        </div>

        {/* SEO Score Distribution */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            SEO Score Distribution
          </h2>
          {isLoading ? (
            <Skeleton className="h-48 w-full" aria-hidden="true" />
          ) : (
            <SeoDistributionChart data={seoDistribution} />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
