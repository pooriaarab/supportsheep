"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";
import { useInterviewCostSummary } from "@/hooks/use-interview-cost-summary";
import { PageShell } from "@/components/ui/layout/page-shell";
import { Card } from "@repo/ui/primitives/card";
import { StatCard } from "@/components/shared/stat-card";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { DollarSign, Mic, BarChart3, AlertCircle } from "lucide-react";

// Dynamically import Recharts to prevent SSR errors
const CostRechartsCharts = dynamic(
  () =>
    import("recharts").then(
      ({
        Bar,
        BarChart,
        Line,
        LineChart,
        ResponsiveContainer,
        Tooltip: RechartsTooltip,
        XAxis,
        YAxis,
      }) => {
        const tooltipStyle = {
          fontSize: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--popover)",
          color: "var(--foreground)",
        };

        return function CostCharts({
          byDay,
          byMonth,
        }: {
          byDay: Array<{ date: string; costUsd: number; interviews: number }>;
          byMonth: Array<{ month: string; costUsd: number; interviews: number }>;
        }) {
          return (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 space-y-4 border bg-card">
                <h3 className="text-base font-semibold text-foreground">Daily Spend (Last 30 Days)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={byDay} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => {
                          const parts = val.split("-");
                          return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `$${val}`}
                        width={45}
                      />
                      <RechartsTooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => {
                          const nameStr = name ? String(name) : "";
                          if (nameStr === "costUsd") return [`$${Number(value).toFixed(2)}`, "Cost (USD)"];
                          if (nameStr === "interviews") return [String(value), "Interviews"];
                          return [String(value), nameStr];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="costUsd"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 space-y-4 border bg-card">
                <h3 className="text-base font-semibold text-foreground">Monthly Spend (Last 12 Months)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byMonth} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `$${val}`}
                        width={45}
                      />
                      <RechartsTooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => {
                          const nameStr = name ? String(name) : "";
                          if (nameStr === "costUsd") return [`$${Number(value).toFixed(2)}`, "Cost (USD)"];
                          if (nameStr === "interviews") return [String(value), "Interviews"];
                          return [String(value), nameStr];
                        }}
                      />
                      <Bar
                        dataKey="costUsd"
                        fill="var(--primary)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          );
        };
      }
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4 border bg-card">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-72 w-full" />
        </Card>
        <Card className="p-6 space-y-4 border bg-card">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-72 w-full" />
        </Card>
      </div>
    ),
  },
);

export default function CostDashboardPage() {
  const { user: currentUser } = useAuth();
  const { data: userProfile, isLoading: isProfileLoading } = useUserQuery(
    currentUser?.uid ?? ""
  );

  const isAuthorized = useMemo(() => {
    if (isProfileLoading) return true; // prevent flash
    if (!userProfile) return false;
    const role = userProfile.role as string;
    return role === "admin" || role === "editor" || role === "owner";
  }, [userProfile, isProfileLoading]);

  const { data: summary, isLoading: isSummaryLoading } = useInterviewCostSummary({
    enabled: isAuthorized && !isProfileLoading,
    // Refresh every 15s while the dashboard is open so in-flight live
    // sessions reflect their accruing spend without a manual reload. The
    // backend is cheap (one indexed query + small live aggregation loop)
    // and 15s feels live without hammering Firestore.
    refetchInterval: 15_000,
  });

  if (isProfileLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full animate-pulse bg-primary" />
        Checking admin permissions...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <Card className="p-6 border border-error bg-error/10 text-error flex flex-col items-center text-center gap-4">
          <AlertCircle className="size-12 text-error" />
          <h2 className="text-lg font-bold">Access Forbidden</h2>
          <p className="text-sm">You are not authorized to view this page. Admin, Editor, or Owner role is required.</p>
        </Card>
      </div>
    );
  }

  return (
    <PageShell breadcrumbs={[{ label: "Interview Spend & Costs" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Interview Spend & Costs</h1>
          <p className="text-sm text-muted-foreground">Monitor voice-agent expenses and tracking against monthly budget caps.</p>
        </div>

        {isSummaryLoading || !summary ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
            <div data-testid="loading-summary" className="hidden">Loading summary</div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Spend This Month"
                value={`$${summary.thisMonth.totalUsd.toFixed(2)}`}
                icon={DollarSign}
                subtitle="Calculated in real-time"
              />

              <StatCard
                label="Interviews Completed"
                value={summary.thisMonth.totalInterviews}
                icon={Mic}
                subtitle="Interviews ended this month"
              />

              <Card className="p-6 border bg-card flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <BarChart3 className="size-3.5" />
                    Monthly Cost Cap
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {summary.thisMonth.capUsd !== null ? `$${summary.thisMonth.capUsd}` : "No Cap"}
                  </p>
                  <p className="text-xs text-muted-foreground/70">Workspace hard spending cap limit</p>
                </div>

                {summary.thisMonth.capUsd !== null && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget Utilization</span>
                      <span className="font-semibold text-foreground">
                        {summary.thisMonth.capUtilizationPct !== null
                          ? `${summary.thisMonth.capUtilizationPct.toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          (summary.thisMonth.capUtilizationPct ?? 0) >= 90
                            ? "bg-error"
                            : (summary.thisMonth.capUtilizationPct ?? 0) >= 75
                              ? "bg-warning"
                              : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, summary.thisMonth.capUtilizationPct ?? 0)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Recharts Row */}
            <CostRechartsCharts byDay={summary.byDay} byMonth={summary.byMonth} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
