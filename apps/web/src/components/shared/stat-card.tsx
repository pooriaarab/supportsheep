/**
 * Stat Card Component
 *
 * Reusable KPI card for displaying metrics with:
 * - Small inline icon next to the label
 * - Formatted numeric values
 * - Trend indicator (up/down/flat)
 * - Loading skeleton state
 */

"use client";

import { type LucideIcon } from "lucide-react";
import { Card } from "@repo/ui/primitives/card";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { cn } from "@repo/ui/utils";

interface StatCardTrend {
  value: number;
  direction: "up" | "down" | "flat";
}

interface StatCardProps {
  /** Metric label displayed above the value */
  label: string;

  /** Metric value (numbers are formatted with toLocaleString, ReactNode rendered as-is) */
  value: React.ReactNode;

  /** Lucide icon component */
  icon: LucideIcon;

  /** Optional trend indicator */
  trend?: StatCardTrend;

  /** Optional subtitle shown below the value */
  subtitle?: string;

  /** Show loading skeleton */
  loading?: boolean;
}

function StatCardSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Card>
  );
}

// Directional colors for trend indicators.
const trendColors: Record<StatCardTrend["direction"], string> = {
  up: "text-success dark:text-success",
  down: "text-error dark:text-error",
  flat: "text-muted-foreground",
};

const trendSymbols: Record<StatCardTrend["direction"], string> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

function formatValue(value: React.ReactNode): React.ReactNode {
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </p>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {formatValue(value)}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70">{subtitle}</p>
        )}
        {trend && (
          <p
            className={cn(
              "text-sm font-medium flex items-center gap-1",
              trendColors[trend.direction],
            )}
          >
            <span>{trendSymbols[trend.direction]}</span>
            <span>{trend.value}%</span>
          </p>
        )}
      </div>
    </Card>
  );
}
