import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogConfig } from "@repo/types";
import {
  buildArticleItemListSchema,
  buildBlogListingSchema,
  buildCollectionPageSchema,
  buildPublicSiteSchema,
  buildSiteFaqSchema,
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePublicSiteUrl", () => {
  it("ignores localhost app urls in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("DEV_AUTH_BYPASS", "");

    expect(resolvePublicSiteUrl()).toBe("https://supportsheep.com");
  });

  it("uses an explicit non-localhost app url in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://supportsheep.com/");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("DEV_AUTH_BYPASS", "");

    expect(resolvePublicSiteUrl()).toBe("https://supportsheep.com");
  });

  it("honors a localhost app url when DEV_AUTH_BYPASS is enabled (E2E)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");

    expect(resolvePublicSiteUrl()).toBe("http://localhost:3000");
  });
});

const baseConfig: BlogConfig = {
  blogId: "default",
  siteName: "Supportsheep",
  siteDescription: "Small business website tips from the Supportsheep team.",
  logo: "",
  homepage: {
    layout: "grid",
    postsPerPage: 12,
    featuredCategory: null,
  },
  seo: {
    defaultMetaTitle: "Supportsheep",
    defaultMetaDescription: "",
    googleAnalyticsId: "",
    clarityId: "",
  },
  ai: {
    defaultProvider: "claude",
    providers: {
      claude: { apiKey: "", model: "" },
      gpt: { apiKey: "", model: "" },
      gemini: { apiKey: "", model: "" },
    },
    defaultContextTagId: "",
    defaultSkillsPipeline: [],
  },
  publishing: {
    defaultStatus: "draft",
    autoSchedule: false,
  },
};

describe("stringifyJsonLdForScript", () => {
  it("escapes `<` so embedded content cannot close the script tag", () => {
    const output = stringifyJsonLdForScript({ body: "</script><b>x</b>" });
    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c/script>");
    expect(output).toContain("\\u003cb>");
  });
});

describe("buildPublicSiteSchema", () => {
  const siteUrl = "https://supportsheep.com";
  const schema = buildPublicSiteSchema(baseConfig, siteUrl);

  it("emits an Organization with entity identifiers, contacts, and parent org", () => {
    const org = schema["@graph"].find(
      (node) => node["@type"] === "Organization",
    );
    expect(org).toBeDefined();
    expect(org).toMatchObject({
      name: "Supportsheep",
      alternateName: "Supportsheep",
      url: siteUrl,
      description: baseConfig.siteDescription,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.png`,
        width: 112,
        height: 112,
      },
    });
    expect(org?.sameAs).toEqual(
      expect.arrayContaining([
        "https://supportsheep.com",
        "https://github.com/pooriaarab/blogbat",
      ]),
    );
    expect(org).toMatchObject({
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: "https://support.supportsheep.com",
      },
    });
  });

  it("emits a WebSite with a SearchAction pointing at /blog/search", () => {
    const website = schema["@graph"].find(
      (node) => node["@type"] === "WebSite",
    );
    expect(website).toBeDefined();
    expect(website).toMatchObject({
      name: baseConfig.siteName,
      url: siteUrl,
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
      },
    });
    const action = (website as { potentialAction?: { target?: unknown } })
      ?.potentialAction;
    expect(action?.target).toMatchObject({
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/blog/search?q={search_term_string}`,
    });
  });

  it("emits a SoftwareApplication node for Supportsheep with a free Offer", () => {
    const software = schema["@graph"].find(
      (node) => node["@type"] === "SoftwareApplication",
    );
    expect(software).toMatchObject({
      name: "Supportsheep",
      applicationCategory: "WebApplication",
      operatingSystem: "Web",
      url: "https://supportsheep.com",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    });
  });

  it("emits a WebApplication node for the Supportsheep product", () => {
    const webApplication = schema["@graph"].find(
      (node) => node["@type"] === "WebApplication",
    );
    expect(webApplication).toMatchObject({
      "@id": "https://supportsheep.com/#webapplication",
      name: "Supportsheep",
      applicationCategory: "WebsiteBuilderApplication",
      operatingSystem: "Web",
      url: "https://supportsheep.com",
    });
  });

  it("emits a site FAQPage for answer engines", () => {
    const faq = schema["@graph"].find((node) => node["@type"] === "FAQPage");
    expect(faq).toMatchObject({
      "@id": `${siteUrl}/#faq`,
      mainEntity: expect.arrayContaining([
        expect.objectContaining({
          "@type": "Question",
          name: "What is Supportsheep?",
        }),
      ]),
    });
  });
});

describe("buildSiteFaqSchema", () => {
  it("returns stable FAQPage JSON-LD", () => {
    const siteUrl = "https://supportsheep.com";
    const schema = buildSiteFaqSchema(siteUrl);

    expect(schema).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      url: siteUrl,
    });
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(4);
    expect(schema.mainEntity[0]).toMatchObject({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
      },
    });
  });
});

describe("buildArticleItemListSchema", () => {
  const siteUrl = "https://supportsheep.com";
  const articles = [
    {
      id: "a",
      title: "First Article",
      slug: "first-article",
      category: "guides",
    },
    {
      id: "b",
      title: "Second Article",
      slug: "second-article",
      canonicalPath: "/second-article/",
      category: "guides",
    },
  ];

  it("emits an ItemList with position and absolute URLs", () => {
    const schema = buildArticleItemListSchema(articles, siteUrl, siteUrl);
    expect(schema).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 2,
    });
    expect(schema.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        url: `${siteUrl}/first-article/`,
        name: "First Article",
      },
      {
        "@type": "ListItem",
        position: 2,
        url: `${siteUrl}/second-article/`,
        name: "Second Article",
      },
    ]);
  });

  it("uses the provided list URL for @id anchoring", () => {
    const schema = buildArticleItemListSchema(
      articles,
      siteUrl,
      `${siteUrl}/blog?page=2`,
    );
    expect(schema["@id"]).toBe(`${siteUrl}/blog?page=2#itemlist`);
  });
});

describe("buildBlogListingSchema", () => {
  it("emits a Blog node pointing at the Organization publisher", () => {
    const siteUrl = "https://supportsheep.com";
    const schema = buildBlogListingSchema(baseConfig, siteUrl, siteUrl);
    expect(schema).toMatchObject({
      "@type": "Blog",
      url: siteUrl,
      name: baseConfig.siteName,
      description: baseConfig.siteDescription,
      inLanguage: "en-US",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    });
  });
});

describe("buildCollectionPageSchema", () => {
  it("emits a CollectionPage anchored to the website @id", () => {
    const siteUrl = "https://supportsheep.com";
    const categoryUrl = `${siteUrl}/category/guides`;
    const schema = buildCollectionPageSchema(siteUrl, categoryUrl, {
      name: "Guides",
      description: "How-to articles",
    });
    expect(schema).toMatchObject({
      "@type": "CollectionPage",
      url: categoryUrl,
      name: "Guides",
      description: "How-to articles",
      inLanguage: "en-US",
      isPartOf: {
        "@id": `${siteUrl}/#website`,
      },
    });
  });
});
