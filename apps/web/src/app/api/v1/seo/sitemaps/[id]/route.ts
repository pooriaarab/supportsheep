/**
 * Sitemap Detail API
 *
 * GET    /api/v1/seo/sitemaps/:id -- Get sitemap with parsed URLs
 * PATCH  /api/v1/seo/sitemaps/:id -- Refresh (re-fetch and re-parse)
 * DELETE /api/v1/seo/sitemaps/:id -- Delete a sitemap
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import {
  getSitemap,
  updateSitemap,
  deleteSitemap,
} from "@/lib/seo/sitemaps-repository";

const log = createLogger("api:seo:sitemaps:detail");

type RouteParams = { id: string };

const refreshSchema = z.object({
  action: z.literal("refresh"),
});

/**
 * Parse URLs from sitemap XML content.
 */
function parseUrlsFromXml(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match = locRegex.exec(xml);
  while (match) {
    const url = match[1]?.trim();
    if (url) {
      urls.push(url);
    }
    match = locRegex.exec(xml);
  }
  return urls;
}

/**
 * GET /api/v1/seo/sitemaps/:id
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "user",
  handler: async ({ blogId, params }) => {
    const entry = await getSitemap(blogId, params.id);
    if (!entry) {
      return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });
    }
    return NextResponse.json({ data: entry });
  },
});

/**
 * PATCH /api/v1/seo/sitemaps/:id
 * Supports action: "refresh" to re-fetch and re-parse the sitemap
 */
export const PATCH = createApiHandler<{ action: string }, RouteParams>({
  auth: "user",
  input: refreshSchema,
  audit: "refresh_sitemap",
  handler: async ({ blogId, params }) => {
    const entry = await getSitemap(blogId, params.id);
    if (!entry) {
      return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });
    }

    const sitemapUrl = entry.url;
    if (!sitemapUrl) {
      return NextResponse.json(
        { error: "Sitemap has no URL" },
        { status: 400 },
      );
    }

    log.info("Refreshing sitemap", { url: sitemapUrl });

    const response = await fetch(sitemapUrl, {
      cache: "no-store",
      headers: { "User-Agent": "SupportsheepBlog/1.0 Sitemap Parser" },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch sitemap: ${response.status} ${response.statusText}`,
        },
        { status: 400 },
      );
    }

    const xml = await response.text();
    const urls = parseUrlsFromXml(xml);

    await updateSitemap(blogId, params.id, { urls, lastFetched: Date.now() });

    log.info("Sitemap refreshed", { url: sitemapUrl, count: urls.length });

    return NextResponse.json({ id: params.id, urlCount: urls.length });
  },
});

/**
 * DELETE /api/v1/seo/sitemaps/:id
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "user",
  audit: "delete_sitemap",
  handler: async ({ blogId, params }) => {
    const deleted = await deleteSitemap(blogId, params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  },
});
