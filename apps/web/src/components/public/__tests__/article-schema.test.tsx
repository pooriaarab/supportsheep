import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticlePage } from "@/components/public/article-page";
import type { Article, Author } from "@repo/types";

/**
 * Extract the first JSON-LD `<script>` block matching the requested `@type`.
 *
 * `stringifyJsonLdForScript` escapes every `<` character inside the JSON body
 * as a JSON unicode escape (backslash-u-003c) — not as the HTML entity `&lt;`.
 * This prevents a string containing `</script>` from prematurely closing the
 * surrounding script tag. Because it is a standard JSON unicode escape,
 * `JSON.parse` decodes it back to `<` natively, so no manual unescape step
 * is required here.
 */
function extractJsonLdByType(
  html: string,
  type: string,
): Record<string, unknown> | null {
  const matches = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]+?)<\/script>/g,
    ),
  ];
  for (const m of matches) {
    try {
      const data = JSON.parse(m[1]) as Record<string, unknown>;
      if (data["@type"] === type) return data;
    } catch {
      // Skip unparseable blocks; other blocks may still match.
    }
  }
  return null;
}

const baseArticle: Article & { id: string } = {
  id: "article-1",
  blogId: "default",
  title: "How to Launch a Small Business Website",
  slug: "how-to-launch-a-small-business-website",
  body: "<p>Body copy</p>",
  draftBody: "",
  excerpt: "A short excerpt describing the article.",
  summary: "",
  status: "published",
  scheduledAt: null,
  publishedAt: "2026-04-15T00:00:00.000Z",
  postType: "how_to",
  category: "guides",
  tags: [],
  author: "Supportsheep",
  featuredImage: {
    url: "https://cdn.example.com/hero.jpg",
    alt: "Hero image",
    width: 1600,
    height: 900,
  },
  ogImage: "",
  metaTitle: "",
  metaDescription: "A meta description for SEO.",
  keywords: ["small business", "website"],
  seoScore: 0,
  internalLinks: [],
  externalLinks: [],
  versions: [],
  generatedBy: "manual",
  generationMeta: null,
  wordCount: 120,
  readingTime: 1,
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
};

const SITE_URL = "https://supportsheep.com";

describe("ArticlePage BlogPosting JSON-LD E-E-A-T fields", () => {
  it("emits a complete BlogPosting with all Google-required rich-result fields", () => {
    const html = renderToStaticMarkup(
      <ArticlePage
        article={baseArticle}
        relatedArticles={[]}
        categories={[]}
        siteUrl={SITE_URL}
      />,
    );

    const ld = extractJsonLdByType(html, "BlogPosting");

    expect(ld).not.toBeNull();
    expect(ld!["@context"]).toBe("https://schema.org");
    expect(ld!["@type"]).toBe("BlogPosting");

    // headline: required, and Google recommends <=110 chars.
    expect(typeof ld!.headline).toBe("string");
    expect((ld!.headline as string).length).toBeGreaterThan(0);
    expect((ld!.headline as string).length).toBeLessThanOrEqual(110);

    // author: required with a name.
    expect(ld!.author).toMatchObject({
      "@type": expect.any(String),
      name: expect.any(String),
    });

    // publisher: Organization with name and logo (ImageObject).
    expect(ld!.publisher).toMatchObject({
      "@type": "Organization",
      name: expect.any(String),
      logo: {
        "@type": "ImageObject",
        url: expect.any(String),
      },
    });

    // datePublished / dateModified: ISO 8601 strings.
    expect(typeof ld!.datePublished).toBe("string");
    expect(Number.isFinite(Date.parse(ld!.datePublished as string))).toBe(true);
    expect(typeof ld!.dateModified).toBe("string");
    expect(Number.isFinite(Date.parse(ld!.dateModified as string))).toBe(true);

    // image: either a URL string, an array of URLs, or an ImageObject
    // with a url. Accept all valid shapes.
    const image = ld!.image;
    expect(image).toBeTruthy();
    if (typeof image === "string") {
      expect(image.length).toBeGreaterThan(0);
    } else if (Array.isArray(image)) {
      expect(image.length).toBeGreaterThan(0);
    } else {
      expect(image).toMatchObject({ url: expect.any(String) });
    }

    // mainEntityOfPage: points at the canonical URL.
    expect(ld!.mainEntityOfPage).toMatchObject({
      "@type": "WebPage",
      "@id": expect.stringContaining(
        "/how-to-launch-a-small-business-website",
      ),
    });
  });

  it("emits a Person author with url and sameAs for E-E-A-T when a named author is provided", () => {
    const author: Author = {
      id: "jane-doe",
      name: "Jane Doe",
      jobTitle: "Senior Editor",
      bio: "Jane writes about small business websites.",
      avatarUrl: "https://cdn.example.com/jane.png",
      sameAs: ["https://www.linkedin.com/in/jane-doe"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      <ArticlePage
        article={{ ...baseArticle, authorId: "jane-doe" }}
        relatedArticles={[]}
        categories={[]}
        siteUrl={SITE_URL}
        author={author}
      />,
    );

    const ld = extractJsonLdByType(html, "BlogPosting");
    expect(ld).not.toBeNull();

    expect(ld!.author).toMatchObject({
      "@type": "Person",
      name: "Jane Doe",
      url: `${SITE_URL}/authors/jane-doe`,
      sameAs: ["https://www.linkedin.com/in/jane-doe"],
    });
  });
});
