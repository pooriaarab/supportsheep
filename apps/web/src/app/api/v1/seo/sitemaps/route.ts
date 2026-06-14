/**
 * Sitemaps API
 *
 * GET  /api/v1/seo/sitemaps -- List all sitemaps
 * POST /api/v1/seo/sitemaps -- Fetch and parse a sitemap XML
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { createSitemapSchema } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";
import {
  listSitemaps,
  createSitemap,
} from "@/lib/seo/sitemaps-repository";

const log = createLogger("api:seo:sitemaps");

/**
 * Fetch XML from a URL with redirect support.
 * Returns the XML string or null if the response is not XML.
 */
async function fetchXml(
  url: string,
): Promise<{ xml: string | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "SoloBlog/1.0 Sitemap Parser" },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        xml: null,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();
    const trimmed = text.trim();

    // Detect HTML responses
    if (
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<HTML")
    ) {
      return { xml: null, error: "URL returned HTML, not XML" };
    }

    return { xml: text, error: null };
  } catch (err) {
    return {
      xml: null,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

/**
 * Parse <loc> URLs from XML content within a specific parent tag.
 */
function parseLocsInTag(xml: string, parentTag: string): string[] {
  const urls: string[] = [];
  const parentRegex = new RegExp(
    `<${parentTag}[^>]*>[\\s\\S]*?</${parentTag}>`,
    "gi",
  );
  let parentMatch = parentRegex.exec(xml);
  while (parentMatch) {
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let locMatch = locRegex.exec(parentMatch[0]);
    while (locMatch) {
      const url = locMatch[1]?.trim();
      if (url) urls.push(url);
      locMatch = locRegex.exec(parentMatch[0]);
    }
    parentMatch = parentRegex.exec(xml);
  }
  return urls;
}

/**
 * Check if XML is a sitemap index (contains <sitemap> entries).
 */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Parse URLs from sitemap XML content.
 * Handles both regular sitemaps (<url><loc>) and sitemap index files (<sitemap><loc>).
 * For sitemap indexes, fetches each sub-sitemap and collects all URLs.
 */
async function parseUrlsFromXml(xml: string): Promise<string[]> {
  // If this is a sitemap index, fetch each sub-sitemap
  if (isSitemapIndex(xml)) {
    const subSitemapUrls = parseLocsInTag(xml, "sitemap");
    log.info("Detected sitemap index", {
      subSitemapCount: subSitemapUrls.length,
    });

    const subSitemapUrlSets = await Promise.all(
      subSitemapUrls.map(async (subUrl) => {
        const { xml: subXml } = await fetchXml(subUrl);
        return subXml ? parseLocsInTag(subXml, "url") : [];
      }),
    );
    return subSitemapUrlSets.flat();
  }

  // Regular sitemap: extract <url><loc> entries
  const urls = parseLocsInTag(xml, "url");

  // Fallback: if no <url> tags found, try bare <loc> tags
  if (urls.length === 0) {
    const fallbackUrls: string[] = [];
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match = locRegex.exec(xml);
    while (match) {
      const url = match[1]?.trim();
      if (url) fallbackUrls.push(url);
      match = locRegex.exec(xml);
    }
    return fallbackUrls;
  }

  return urls;
}

/**
 * Common sitemap paths to try when the given URL fails.
 */
function getSitemapCandidates(inputUrl: string): string[] {
  try {
    const parsed = new URL(inputUrl);
    const origin = parsed.origin;
    const candidates = [
      inputUrl,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/wp-sitemap.xml`,
    ];
    // Deduplicate while preserving order
    return [...new Set(candidates)];
  } catch {
    return [inputUrl];
  }
}

/**
 * GET /api/v1/seo/sitemaps
 * List all sitemaps
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const sitemaps = await listSitemaps(blogId);
    const data = sitemaps.map((s) => ({
      ...s,
      urlCount: s.urls.length,
    }));
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/seo/sitemaps
 * Fetch a sitemap XML, parse its URLs, and save to D1
 */
export const POST = createApiHandler({
  auth: "user",
  input: createSitemapSchema,
  audit: "create_sitemap",
  handler: async ({ blogId, body }) => {
    log.info("Fetching sitemap", { url: body.url });

    const candidates = getSitemapCandidates(body.url);
    let xml: string | null = null;
    let successUrl = body.url;
    const errors: string[] = [];

    for (const candidateUrl of candidates) {
      const result = await fetchXml(candidateUrl);
      if (result.xml) {
        xml = result.xml;
        successUrl = candidateUrl;
        break;
      }
      errors.push(`${candidateUrl}: ${result.error}`);
    }

    if (!xml) {
      return NextResponse.json(
        {
          error: `Failed to fetch sitemap from any URL. Tried: ${errors.join("; ")}`,
        },
        { status: 400 },
      );
    }

    const urls = await parseUrlsFromXml(xml);

    if (urls.length === 0) {
      return NextResponse.json(
        {
          error:
            "No URLs found in sitemap. The XML was fetched but contained no <url> or <sitemap> entries.",
        },
        { status: 400 },
      );
    }

    log.info("Parsed sitemap URLs", { url: successUrl, count: urls.length });

    const { id } = await createSitemap(blogId, {
      url: successUrl,
      urls,
      lastFetched: Date.now(),
    });

    return NextResponse.json(
      { id, urlCount: urls.length },
      { status: 201 },
    );
  },
});
