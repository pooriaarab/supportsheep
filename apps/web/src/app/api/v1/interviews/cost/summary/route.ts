import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { createApiHandler } from "@/lib/create-api-handler";
import { getBlogConfig } from "@/lib/blog-config";
import { aggregateUsage } from "@/lib/interviews/aggregate-usage";
import { computeTotalCost, roundCostUsd } from "@/lib/interviews/cost";
import { getDb } from "@/db";
import { interviews } from "@/db/schema/interviews";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type { UserRole } from "@repo/types";

export const GET = createApiHandler({
  auth: "user",
  handler: async ({ role: ctxRole }) => {
    // Guard the cost dashboard: only admin/editor/owner may view it. Role comes
    // from the caller's blog membership (ctx), not a Firestore user lookup.
    const role = (ctxRole ?? null) as UserRole | null;

    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2. Fetch soft cap from blog configuration
    const config = await getBlogConfig();
    const capUsd = config?.interview?.monthlyCostCapUsd ?? null;

    // 3. Define time thresholds
    const startOfThisMonth = new Date();
    startOfThisMonth.setDate(1);
    startOfThisMonth.setHours(0, 0, 0, 0);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const twelveMonthsAgoMs = twelveMonthsAgo.getTime();
    const startOfThisMonthMs = startOfThisMonth.getTime();

    // 4. Generate pre-populated days (last 30 days ending today)
    const byDayMap: Record<string, { date: string; costUsd: number; interviews: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      byDayMap[dateStr] = { date: dateStr, costUsd: 0, interviews: 0 };
    }

    // 5. Generate pre-populated months (last 12 months ending this month)
    const byMonthMap: Record<string, { month: string; costUsd: number; interviews: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7);
      byMonthMap[monthStr] = { month: monthStr, costUsd: 0, interviews: 0 };
    }

    const db = getDb();

    // 6. Query interviews where endedAt >= 12 months ago from D1
    const endedRows = await db
      .select()
      .from(interviews)
      .where(
        and(
          eq(interviews.blogId, DEFAULT_blog_id),
          isNotNull(interviews.endedAt),
          gte(interviews.endedAt, twelveMonthsAgoMs),
        ),
      );

    // 6b. Pull in-flight (live) interviews from this month
    const liveRows = await db
      .select()
      .from(interviews)
      .where(
        and(
          eq(interviews.blogId, DEFAULT_blog_id),
          eq(interviews.status, "live"),
          gte(interviews.createdAt, startOfThisMonthMs),
        ),
      );

    let totalUsd = 0;
    let totalInterviews = 0;

    // 7. Aggregate ended interviews
    for (const row of endedRows) {
      const endedAt = row.endedAt;
      if (!endedAt) continue;

      const endedAtDate = new Date(endedAt);
      const costUsd = row.costUsd ?? 0;

      // Current calendar month aggregation
      if (endedAtDate >= startOfThisMonth) {
        totalUsd += costUsd;
        totalInterviews += 1;
      }

      // Group by day (30 days)
      const dateStr = endedAtDate.toISOString().substring(0, 10);
      if (byDayMap[dateStr]) {
        byDayMap[dateStr].costUsd += costUsd;
        byDayMap[dateStr].interviews += 1;
      }

      // Group by month (12 months)
      const monthStr = endedAtDate.toISOString().substring(0, 7);
      if (byMonthMap[monthStr]) {
        byMonthMap[monthStr].costUsd += costUsd;
        byMonthMap[monthStr].interviews += 1;
      }
    }

    // 7b. Fold in live sessions: aggregate their token events on the fly
    for (const row of liveRows) {
      try {
        const usage = await aggregateUsage(row.blogId, row.id);
        const liveCostUsd = computeTotalCost(usage.realtime, usage.writer);
        totalUsd += liveCostUsd;
        totalInterviews += 1;
      } catch {
        // Best-effort: a failed live aggregation must not 500 the dashboard.
      }
    }

    // 8. Round results and format arrays
    totalUsd = roundCostUsd(totalUsd);

    const byDay = Object.keys(byDayMap)
      .sort()
      .map((date) => ({
        date,
        costUsd: roundCostUsd(byDayMap[date].costUsd),
        interviews: byDayMap[date].interviews,
      }));

    const byMonth = Object.keys(byMonthMap)
      .sort()
      .map((month) => ({
        month,
        costUsd: roundCostUsd(byMonthMap[month].costUsd),
        interviews: byMonthMap[month].interviews,
      }));

    const capUtilizationPct =
      capUsd && capUsd > 0
        ? roundCostUsd((totalUsd / capUsd) * 100)
        : capUsd !== null
          ? 0
          : null;

    return NextResponse.json({
      thisMonth: {
        totalUsd,
        totalInterviews,
        capUsd,
        capUtilizationPct,
      },
      byDay,
      byMonth,
    });
  },
});
