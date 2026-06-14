"use client";

import { PageHeader } from "@/components/ui/layout/page-header";
import { StatGrid } from "@/components/shared/stat-grid";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import { Activity, Database, Wifi, Zap, ArrowRight } from "lucide-react";

const usageStats = [
  {
    label: "API Calls",
    value: "47,283",
    icon: Activity,
    trend: { value: 15, direction: "up" as const },
    subtitle: "of 100,000 limit",
  },
  {
    label: "Storage Used",
    value: "2.4 GB",
    icon: Database,
    trend: { value: 8, direction: "up" as const },
    subtitle: "of 10 GB limit",
  },
  {
    label: "Bandwidth",
    value: "12.8 GB",
    icon: Wifi,
    trend: { value: 3, direction: "down" as const },
    subtitle: "of 50 GB limit",
  },
  {
    label: "Functions",
    value: "1,847",
    icon: Zap,
    trend: { value: 22, direction: "up" as const },
    subtitle: "invocations this month",
  },
];

/** Simple bar chart rendered with CSS -- no chart library needed */
function UsageBar({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isHigh = percentage > 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHigh ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {percentage.toFixed(1)}% used
      </p>
    </div>
  );
}

const dailyUsage = [
  { day: "Mon", calls: 6500 },
  { day: "Tue", calls: 7200 },
  { day: "Wed", calls: 8100 },
  { day: "Thu", calls: 7800 },
  { day: "Fri", calls: 9200 },
  { day: "Sat", calls: 4300 },
  { day: "Sun", calls: 4100 },
];

function MiniBarChart() {
  const max = Math.max(...dailyUsage.map((d) => d.calls));

  return (
    <div className="flex items-end gap-2 h-32">
      {dailyUsage.map((day) => (
        <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end h-24">
            <div
              className="w-full bg-primary/80 rounded-t-sm transition-all duration-300 min-h-[2px]"
              style={{ height: `${(day.calls / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{day.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function UsagePage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Usage" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Stats */}
          <StatGrid columns={4}>
            {usageStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </StatGrid>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Usage Bars */}
            <Card className="p-6 space-y-6">
              <h3 className="text-sm font-semibold text-foreground">
                Resource Usage
              </h3>
              <UsageBar
                label="API Calls"
                used={47283}
                limit={100000}
                unit="calls"
              />
              <UsageBar
                label="Storage"
                used={2.4}
                limit={10}
                unit="GB"
              />
              <UsageBar
                label="Bandwidth"
                used={12.8}
                limit={50}
                unit="GB"
              />
            </Card>

            {/* Daily API Calls Chart */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                API Calls (Last 7 Days)
              </h3>
              <MiniBarChart />
              <p className="text-xs text-muted-foreground mt-3">
                Average: {Math.round(dailyUsage.reduce((a, b) => a + b.calls, 0) / 7).toLocaleString()} calls/day
              </p>
            </Card>
          </div>

          {/* Current Plan */}
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Current Plan
                  </h3>
                  <Badge>Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  $29/month &middot; Billed monthly &middot; Renews April 1,
                  2026
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Unlimited team members, 100k API requests, advanced analytics,
                  and priority support.
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-xs shrink-0">
                Upgrade Plan
                <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
