/**
 * Sub-sitemap: author archive pages.
 */

import { NextResponse } from "next/server";
import { getAuthorPath } from "@/lib/authors";
import { listAuthors } from "@/lib/authors/repository";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { buildUrlset, xmlResponseHeaders, type SitemapUrl } from "@/lib/sitemap-xml";

// TODO(M5-cache): path-keyed ISR (`revalidate`). Make the cache key host-aware
// before serving distinct tenants on `{slug}.supportsheep.com`.
export const revalidate = 3600;

function toLastmod(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

export async function GET(): Promise<NextResponse> {
  const siteUrl = resolvePublicSiteUrl();
  const urls: SitemapUrl[] = [];

  try {
    const blogId = await getRequestBlogId();
    const authors = await listAuthors(blogId);
    for (const author of authors) {
      urls.push({
        loc: `${siteUrl}${getAuthorPath(author.id)}`,
        lastmod: toLastmod(author.updatedAt, author.createdAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // D1 may not be available during build
  }

  return new NextResponse(buildUrlset(urls), { headers: xmlResponseHeaders() });
}
