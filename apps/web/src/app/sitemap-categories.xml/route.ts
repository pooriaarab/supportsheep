/**
 * Sub-sitemap: category archive pages.
 */

import { NextResponse } from "next/server";
import { listCategories } from "@/lib/categories/repository";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { buildUrlset, xmlResponseHeaders, type SitemapUrl } from "@/lib/sitemap-xml";

// TODO(M5-cache): path-keyed ISR (`revalidate`). Make the cache key host-aware
// before serving distinct tenants on `{slug}.supportsheep.com`.
export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  const siteUrl = resolvePublicSiteUrl();
  const urls: SitemapUrl[] = [];

  try {
    const blogId = await getRequestBlogId();
    const categories = await listCategories(blogId);
    for (const category of categories) {
      urls.push({
        loc: `${siteUrl}/category/${category.slug}`,
        lastmod: new Date(),
        changefreq: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // D1 may not be available during build
  }

  return new NextResponse(buildUrlset(urls), { headers: xmlResponseHeaders() });
}
