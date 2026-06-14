import { describe, expect, it } from "vitest";
import { buildSitemapIndex, buildUrlset } from "@/lib/sitemap-xml";

describe("buildUrlset", () => {
  it("wraps entries in a urlset envelope", () => {
    const xml = buildUrlset([{ loc: "https://example.com/a" }]);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">',
    );
    expect(xml).toContain("<loc>https://example.com/a</loc>");
    expect(xml).toContain("</urlset>");
  });

  it("escapes ampersands and angle brackets in loc", () => {
    const xml = buildUrlset([{ loc: "https://example.com/?a=1&b=<2>" }]);
    expect(xml).toContain(
      "<loc>https://example.com/?a=1&amp;b=&lt;2&gt;</loc>",
    );
  });

  it("includes optional fields when provided", () => {
    const xml = buildUrlset([
      {
        loc: "https://example.com/",
        lastmod: new Date("2026-04-20T00:00:00Z"),
        changefreq: "weekly",
        priority: 0.8,
      },
    ]);
    expect(xml).toContain("<lastmod>2026-04-20T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });
});

describe("buildSitemapIndex", () => {
  it("emits sitemapindex with sitemap children", () => {
    const xml = buildSitemapIndex([
      { loc: "https://example.com/sitemap-articles.xml" },
      { loc: "https://example.com/sitemap-authors.xml" },
      { loc: "https://example.com/sitemap-categories.xml" },
      { loc: "https://example.com/sitemap-tools.xml" },
    ]);
    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">',
    );
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(4);
    expect(xml).toContain(
      "<loc>https://example.com/sitemap-articles.xml</loc>",
    );
    expect(xml).toContain("<loc>https://example.com/sitemap-tools.xml</loc>");
  });
});
