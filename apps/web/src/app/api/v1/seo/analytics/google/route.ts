import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";

/**
 * GET /api/v1/seo/analytics/google
 *
 * Returns aggregated Google Analytics (GA4) + Search Console (GSC) stats for
 * the dashboard.
 *
 * The original data was populated by a Firebase Cloud Function that synced
 * GA4/GSC into the `analyticsStats` / `seoStats` Firestore collections. That
 * function was deleted in the Cloudflare migration and has no in-repo writer,
 * so the source data no longer exists. This endpoint returns the same response
 * shape with zeroed metrics and empty lists so the dashboard renders an empty
 * (not broken) state.
 *
 * TODO(M2-analytics): repopulate via a Cloudflare-side analytics sync (Workers
 * cron + D1 table) and read from D1 here.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async () => {
    return NextResponse.json({
      data: {
        ga4: {
          pageViews: 0,
          sessions: 0,
          engagementRate: 0,
          topPages: [] as Array<{ url: string; pageViews: number }>,
        },
        gsc: {
          clicks: 0,
          impressions: 0,
          averagePosition: 0,
          topQueries: [] as Array<{ query: string; clicks: number }>,
        },
      },
    });
  },
});
