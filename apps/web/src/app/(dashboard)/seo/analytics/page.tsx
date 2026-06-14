"use client";

import { useMemo } from "react";
import {
  Search,
  AlertTriangle,
  Link as LinkIcon,
  FileText,
  TrendingUp,
  Eye,
  MousePointerClick,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/ui/layout/page-shell";
import { StatGrid } from "@/components/shared/stat-grid";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@repo/ui/primitives/card";
import { Skeleton } from "@repo/ui/primitives/skeleton";

const ScoreDistributionChart = dynamic(
  () =>
    import("./score-distribution-chart").then(
      (mod) => mod.ScoreDistributionChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

interface Article {
  id: string;
  slug: string;
  title: string;
  status: string;
  seoScore: number;
  wordCount: number;
  metaDescription: string;
  keywords: string[];
  internalLinks: string[];
  body: string;
  draftBody: string;
}

interface GoogleAnalyticsSummary {
  ga4: {
    pageViews: number;
    sessions: number;
    engagementRate: number;
  };
  gsc: {
    clicks: number;
    impressions: number;
    averagePosition: number;
  };
}

async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/v1/articles?limit=100");
  if (!res.ok) throw new Error("Failed to fetch articles");
  const json = await res.json();
  return json.data ?? [];
}

async function fetchGoogleAnalyticsSummary(): Promise<GoogleAnalyticsSummary> {
  const res = await fetch("/api/v1/seo/analytics/google");
  if (!res.ok) throw new Error("Failed to fetch Google analytics summary");
  const json = await res.json();
  return json.data;
}

export default function SeoAnalyticsPage() {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["seo-analytics-articles"],
    queryFn: fetchArticles,
  });
  const { data: googleSummary, isLoading: googleSummaryLoading } = useQuery({
    queryKey: ["seo-analytics-google-summary"],
    queryFn: fetchGoogleAnalyticsSummary,
  });

  const published = useMemo(
    () => articles.filter((a) => a.status === "published"),
    [articles],
  );

  const avgScore = useMemo(() => {
    const scores = published.reduce(
      (acc, article) => {
        if (typeof article.seoScore === "number") {
          acc.total += article.seoScore;
          acc.count += 1;
        }
        return acc;
      },
      { total: 0, count: 0 },
    );
    if (scores.count === 0) return 0;
    return Math.round(scores.total / scores.count);
  }, [published]);

  const missingMeta = useMemo(
    () => articles.filter((a) => !a.metaDescription),
    [articles],
  );

  const noInternalLinks = useMemo(
    () =>
      articles.filter(
        (a) => !Array.isArray(a.internalLinks) || a.internalLinks.length === 0,
      ),
    [articles],
  );

  const lowDensity = useMemo(
    () =>
      articles.filter((a) => {
        const keywords = Array.isArray(a.keywords) ? a.keywords : [];
        if (keywords.length === 0) return false;
        const body = String(a.body || a.draftBody || "").toLowerCase();
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        if (wordCount === 0) return false;

        return keywords.some((kw) => {
          const count = (body.match(new RegExp(kw.toLowerCase(), "g")) || [])
            .length;
          return (count / wordCount) * 100 < 0.8;
        });
      }),
    [articles],
  );

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

  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      const keywords = Array.isArray(a.keywords) ? a.keywords : [];
      for (const kw of keywords) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }));
  }, [articles]);

  return (
    <PageShell
      breadcrumbs={[
        { label: "SEO", href: "/seo/internal-links" },
        { label: "Analytics" },
      ]}
    >
      <div className="space-y-6">
        <StatGrid columns={4}>
          <StatCard
            label="GA4 Page Views"
            value={googleSummary?.ga4.pageViews ?? 0}
            icon={Eye}
            subtitle={`${googleSummary?.ga4.sessions ?? 0} sessions`}
            loading={googleSummaryLoading}
          />
          <StatCard
            label="Engagement Rate"
            value={`${Math.round((googleSummary?.ga4.engagementRate ?? 0) * 100)}%`}
            icon={TrendingUp}
            subtitle="From synced GA4 rows"
            loading={googleSummaryLoading}
          />
          <StatCard
            label="GSC Clicks"
            value={googleSummary?.gsc.clicks ?? 0}
            icon={MousePointerClick}
            subtitle={`${googleSummary?.gsc.impressions ?? 0} impressions`}
            loading={googleSummaryLoading}
          />
          <StatCard
            label="Avg Position"
            value={(googleSummary?.gsc.averagePosition ?? 0).toFixed(1)}
            icon={Search}
            subtitle="From synced GSC rows"
            loading={googleSummaryLoading}
          />
        </StatGrid>

        {/* Stats */}
        <StatGrid columns={4}>
          <StatCard
            label="Avg SEO Score"
            value={avgScore}
            icon={TrendingUp}
            subtitle={
              avgScore >= 70
                ? "Good"
                : avgScore >= 50
                  ? "Fair"
                  : "Needs improvement"
            }
            loading={isLoading}
          />
          <StatCard
            label="Missing Meta Desc"
            value={missingMeta.length}
            icon={AlertTriangle}
            subtitle={`of ${articles.length} articles`}
            loading={isLoading}
          />
          <StatCard
            label="No Internal Links"
            value={noInternalLinks.length}
            icon={LinkIcon}
            subtitle={`of ${articles.length} articles`}
            loading={isLoading}
          />
          <StatCard
            label="Low Keyword Density"
            value={lowDensity.length}
            icon={Search}
            subtitle="Below 0.8% density"
            loading={isLoading}
          />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Score Distribution */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Score Distribution
            </h3>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ScoreDistributionChart data={seoDistribution} />
            )}
          </Card>

          {/* Top Keywords */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Top Keywords
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : topKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No keywords defined yet
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {topKeywords.map(({ keyword, count }) => (
                  <div
                    key={keyword}
                    className="flex items-center justify-between py-1 px-2 rounded text-sm"
                  >
                    <span className="text-foreground truncate">{keyword}</span>
                    <span className="text-muted-foreground text-xs shrink-0 ml-3">
                      {count} {count === 1 ? "article" : "articles"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Articles Missing Meta */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Articles Missing Meta Descriptions
          </h3>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : missingMeta.length === 0 ? (
            <p className="text-sm text-success py-4 text-center">
              All articles have meta descriptions
            </p>
          ) : (
            <div className="space-y-1">
              {missingMeta.slice(0, 20).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-muted/30"
                >
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{a.title}</span>
                  <span className="text-muted-foreground text-xs ml-auto shrink-0">
                    {a.status}
                  </span>
                </div>
              ))}
              {missingMeta.length > 20 && (
                <p className="text-xs text-muted-foreground pt-2">
                  and {missingMeta.length - 20} more…
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
