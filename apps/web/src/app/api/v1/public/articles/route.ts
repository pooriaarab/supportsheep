import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit-log";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  clampPublicLimit,
  clampPublicPage,
  getPublishedPublicArticles,
  serializePublicArticleSummary,
} from "@/lib/public-api/articles";
import { createMemoryRateLimiter } from "@/lib/public-api/rate-limit";
import { resolvePublicSiteUrl } from "@/lib/public-site";

const listLimiter = createMemoryRateLimiter({ limit: 60, windowMs: 60_000 });

function buildRateLimitHeaders(rate: ReturnType<typeof listLimiter.check>) {
  return {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.resetAt),
  };
}

export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    const rate = listLimiter.check(getClientIp(request) || "unknown");
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            ...buildRateLimitHeaders(rate),
            "Retry-After": String(
              Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)),
            ),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const url = new URL(request.url);
    const page = clampPublicPage(url.searchParams.get("page"));
    const limit = clampPublicLimit(url.searchParams.get("limit"));
    const category = url.searchParams.get("category")?.trim() || null;
    const tag = url.searchParams.get("tag")?.trim() || null;
    const siteUrl = resolvePublicSiteUrl();
    const { articles, hasMore } = await getPublishedPublicArticles({
      page,
      limit,
      category,
      tag,
    });

    return NextResponse.json(
      {
        data: articles.map((article) =>
          serializePublicArticleSummary(article, siteUrl),
        ),
        pagination: {
          page,
          limit,
          count: articles.length,
          hasMore,
        },
      },
      {
        headers: {
          ...buildRateLimitHeaders(rate),
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      },
    );
  },
});
