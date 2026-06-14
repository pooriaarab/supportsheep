"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@repo/ui/primitives/skeleton";

interface ScoreBucket {
  label: string;
  count: number;
}

const SEO_BAR_COLORS = [
  "hsl(0,70%,55%)",
  "hsl(40,70%,50%)",
  "hsl(90,55%,45%)",
  "hsl(150,55%,40%)",
];

const ScoreDistributionRechartsChart = dynamic(
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
        function ScoreDistributionRechartsChart({
          data,
        }: {
          data: ScoreBucket[];
        }) {
          return (
            <ResponsiveContainer width="100%" height={220}>
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
                <RechartsTooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((bucket, index) => (
                    <Cell key={bucket.label} fill={SEO_BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        }

        return ScoreDistributionRechartsChart;
      },
    ),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export function ScoreDistributionChart({ data }: { data: ScoreBucket[] }) {
  return <ScoreDistributionRechartsChart data={data} />;
}
