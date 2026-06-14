/**
 * Sitemap XML builders.
 *
 * Small helpers used by the sitemap index route and each sub-sitemap route
 * to emit well-formed XML (sitemap index + urlset) with correct escaping.
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string | Date;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string | Date;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(value?: string | Date): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildUrlset(urls: SitemapUrl[]): string {
  const entries = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
      const iso = toIso(url.lastmod);
      if (iso) parts.push(`    <lastmod>${iso}</lastmod>`);
      if (url.changefreq) parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
      if (typeof url.priority === "number") {
        parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">\n${entries}\n</urlset>\n`;
}

export function buildSitemapIndex(entries: SitemapIndexEntry[]): string {
  const body = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      const iso = toIso(entry.lastmod);
      if (iso) parts.push(`    <lastmod>${iso}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponseHeaders(): HeadersInit {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  };
}
