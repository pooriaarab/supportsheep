/**
 * Sitemap Index
 *
 * Returns `<sitemapindex>` XML listing each sub-sitemap. Search engines
 * fetch this at `/sitemap.xml` (the URL referenced from robots.txt) and
 * then fan out to the per-section sitemaps listed inside.
 */

import { NextResponse } from "next/server";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { buildSitemapIndex, xmlResponseHeaders } from "@/lib/sitemap-xml";

export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  const siteUrl = resolvePublicSiteUrl();
  const lastmod = new Date();

  const xml = buildSitemapIndex([
    { loc: `${siteUrl}/sitemap-articles.xml`, lastmod },
    { loc: `${siteUrl}/sitemap-authors.xml`, lastmod },
    { loc: `${siteUrl}/sitemap-categories.xml`, lastmod },
    { loc: `${siteUrl}/sitemap-tools.xml`, lastmod },
  ]);

  return new NextResponse(xml, { headers: xmlResponseHeaders() });
}
