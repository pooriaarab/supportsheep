"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@repo/ui/primitives/skeleton";

interface CountDatum {
  label: string;
  count: number;
}

interface CategoryDatum {
  name: string;
  count: number;
}

type DashboardChartProps =
  | { chart: "publishing-activity"; data: CountDatum[] }
  | { chart: "posts-by-category"; data: CategoryDatum[] }
  | { chart: "seo-distribution"; data: CountDatum[] };

const SEO_BAR_COLORS = [
  "hsl(0,70%,55%)",
  "hsl(40,70%,50%)",
  "hsl(90,55%,45%)",
  "hsl(150,55%,40%)",
];

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--foreground)",
};

const DashboardRechartsChart = dynamic(
  () =>
    import("recharts").then(
      ({
        Bar,
        BarChart,
        Cell,
        ResponsiveContainer,
        Tooltip: RechartsTooltip,
        XAxis,
        YAxis,
      }) => {
        function DashboardRechartsChart({ chart, data }: DashboardChartProps) {
          if (chart === "publishing-activity") {
            return (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            );
          }

          if (chart === "posts-by-category") {
            return (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} layout="vertical">
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            );
          }

          return (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((bucket, index) => (
                    <Cell key={bucket.label} fill={SEO_BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        }

        return DashboardRechartsChart;
      },
    ),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export function PublishingActivityChart({ data }: { data: CountDatum[] }) {
  return <DashboardRechartsChart chart="publishing-activity" data={data} />;
}

export function PostsByCategoryChart({ data }: { data: CategoryDatum[] }) {
  return <DashboardRechartsChart chart="posts-by-category" data={data} />;
}

export function SeoDistributionChart({ data }: { data: CountDatum[] }) {
  return <DashboardRechartsChart chart="seo-distribution" data={data} />;
}
