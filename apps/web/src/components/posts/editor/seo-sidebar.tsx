"use client";

/**
 * SEO Scoring Sidebar -- displays real-time SEO score with per-metric breakdown.
 */

import { useMemo } from "react";
import {
  calculateSeoScore,
  type SeoMetric,
  type MetricStatus,
} from "@/lib/seo/scoring";
import type { PostType } from "@repo/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface SeoSidebarProps {
  body: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  postType: PostType;
}

/* -------------------------------------------------------------------------- */
/* Status helpers                                                              */
/* -------------------------------------------------------------------------- */

function statusIcon(status: MetricStatus) {
  switch (status) {
    case "good":
      return <CheckCircle2 className="size-3.5 text-success" />;
    case "warning":
      return <AlertCircle className="size-3.5 text-warning" />;
    case "poor":
      return <XCircle className="size-3.5 text-destructive" />;
  }
}

function scoreColor(total: number): string {
  if (total >= 80) return "text-success";
  if (total >= 50) return "text-warning";
  return "text-destructive";
}

function scoreBg(total: number): string {
  if (total >= 80) return "bg-success/15";
  if (total >= 50) return "bg-warning/15";
  return "bg-destructive/15";
}

function scoreRing(total: number): string {
  if (total >= 80) return "border-success";
  if (total >= 50) return "border-warning";
  return "border-destructive";
}

/* -------------------------------------------------------------------------- */
/* Metric Card                                                                 */
/* -------------------------------------------------------------------------- */

function MetricCard({ metric }: { metric: SeoMetric }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
      <div className="mt-0.5 flex-shrink-0">{statusIcon(metric.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{metric.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {metric.score}/{metric.maxScore}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {metric.detail}
        </p>
        {metric.suggestion && (
          <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
            {metric.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function SeoSidebar({
  body,
  metaTitle,
  metaDescription,
  keywords,
  postType,
}: SeoSidebarProps) {
  const result = useMemo(
    () =>
      calculateSeoScore({
        body,
        metaTitle,
        metaDescription,
        keywords,
        postType,
      }),
    [body, metaTitle, metaDescription, keywords, postType],
  );

  const suggestions = result.metrics.filter((m) => m.suggestion);

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {/* Score gauge */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex items-center justify-center size-20 rounded-full border-4",
            scoreRing(result.total),
            scoreBg(result.total),
          )}
        >
          <span className={cn("text-2xl font-bold", scoreColor(result.total))}>
            {result.total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">SEO Score</p>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        {result.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Suggestions summary */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Improvements
          </h4>
          <ul className="space-y-1">
            {suggestions.map((m) => (
              <li
                key={m.id}
                className="text-[11px] text-muted-foreground flex items-start gap-1.5"
              >
                <span className="mt-0.5 size-1 rounded-full bg-muted-foreground flex-shrink-0" />
                {m.suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
