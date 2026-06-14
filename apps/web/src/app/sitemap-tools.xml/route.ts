/**
 * Sub-sitemap: enabled public free tools.
 */

import { NextResponse } from "next/server";
import { listEnabledPublicFreeTools } from "@/lib/free-tools/repository";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  buildUrlset,
  xmlResponseHeaders,
  type SitemapUrl,
} from "@/lib/sitemap-xml";

export const revalidate = 3600;

function toLastmod(value?: string): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

export async function GET(): Promise<NextResponse> {
  const siteUrl = resolvePublicSiteUrl();
  const urls: SitemapUrl[] = [
    {
      loc: `${siteUrl}/tools`,
      lastmod: new Date(),
      changefreq: "weekly",
      priority: 0.8,
    },
  ];

  try {
    const tools = await listEnabledPublicFreeTools({ surface: "sitemap" });
    for (const tool of tools) {
      urls.push({
        loc: `${siteUrl}/tools/${tool.slug}`,
        lastmod: toLastmod(tool.updatedAt),
        changefreq: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Firestore may not be available during build.
  }

  return new NextResponse(buildUrlset(urls), { headers: xmlResponseHeaders() });
}
