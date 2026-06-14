import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit-log";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  getPublishedPublicArticleBySlug,
  serializePublicArticleDetail,
} from "@/lib/public-api/articles";
import { createMemoryRateLimiter } from "@/lib/public-api/rate-limit";
import { resolvePublicSiteUrl } from "@/lib/public-site";

const detailLimiter = createMemoryRateLimiter({ limit: 120, windowMs: 60_000 });

function buildRateLimitHeaders(rate: ReturnType<typeof detailLimiter.check>) {
  return {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.resetAt),
  };
}

export const GET = createApiHandler<unknown, { slug: string }>({
  auth: "none",
  handler: async ({ request, params }) => {
    const rate = detailLimiter.check(getClientIp(request) || "unknown");
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

    const article = await getPublishedPublicArticleBySlug(params.slug);
    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        {
          status: 404,
          headers: {
            ...buildRateLimitHeaders(rate),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        data: serializePublicArticleDetail(article, resolvePublicSiteUrl()),
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
