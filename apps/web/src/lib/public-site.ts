import type { BlogConfig } from "@repo/types";

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function resolvePublicSiteUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const devAuthBypass = process.env.DEV_AUTH_BYPASS === "true";
  if (
    explicitUrl &&
    (devAuthBypass ||
      !(process.env.NODE_ENV === "production" && isLocalhostUrl(explicitUrl)))
  ) {
    return normalizeSiteUrl(explicitUrl);
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${normalizeSiteUrl(process.env.VERCEL_URL)}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://blogbat.com";
  }

  return "http://localhost:3000";
}

/**
 * Serialize a JSON-LD payload for safe embedding inside a `<script>` tag by
 * escaping `<` characters so a string containing `</script>` (e.g. FAQ copy)
 * cannot prematurely close the surrounding script tag.
 */
export function stringifyJsonLdForScript(jsonLd: unknown): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

const BLOGBAT_ORGANIZATION_SAME_AS = [
  "https://blogbat.com",
  "https://github.com/pooriaarab/blogbat",
];

const BLOGBAT_SITE_FAQS = [
  {
    question: "What is BlogBat?",
    answer:
      "BlogBat is a free AI website builder for small businesses and independent founders. The BlogBat blog publishes practical guidance on launching, improving, and ranking small business websites.",
  },
  {
    question: "Who publishes the BlogBat?",
    answer:
      "The BlogBat is published by BlogBat, focused on helping small businesses create and improve websites with AI-assisted tools.",
  },
  {
    question: "What topics does the BlogBat cover?",
    answer:
      "The blog covers small business websites, search visibility, local SEO, portfolio sites, service pages, online tools, and examples from BlogBat users.",
  },
  {
    question: "Can AI crawlers use BlogBat content?",
    answer:
      "Yes. BlogBat allows search indexing, answer grounding, and model training by well-behaved AI crawlers that respect robots and machine-readable policy files.",
  },
  {
    question: "Where can machines find BlogBat content feeds?",
    answer:
      "Machines can use the RSS feed, sitemap, llms.txt overview, llms-full.txt body dump, and llms-articles.txt complete article URL index.",
  },
];

export function buildSiteFaqSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/#faq`,
    url: siteUrl,
    mainEntity: BLOGBAT_SITE_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * Build the site-wide JSON-LD `@graph` emitted on every public page. Combines
 * Organization, WebSite (with SearchAction), and the BlogBat SoftwareApplication
 * node so search engines can resolve publisher, sitelinks search, and product
 * info from a single document.
 */
export function buildPublicSiteSchema(config: BlogConfig, siteUrl: string) {
  const { "@context": _context, ...siteFaqGraphNode } =
    buildSiteFaqSchema(siteUrl);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "BlogBat",
        alternateName: "BlogBat",
        description: config.siteDescription,
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/favicon.png`,
          width: 112,
          height: 112,
        },
        sameAs: BLOGBAT_ORGANIZATION_SAME_AS,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: "https://support.blogbat.com",
        },
        knowsAbout: [
          "AI website builders",
          "small business websites",
          "local SEO",
          "personal websites",
          "portfolio websites",
          "website publishing",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: config.siteName,
        description: config.siteDescription,
        url: siteUrl,
        inLanguage: "en-US",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/blog/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://blogbat.com/#software",
        name: "BlogBat",
        applicationCategory: "WebApplication",
        operatingSystem: "Web",
        url: "https://blogbat.com",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "WebApplication",
        "@id": "https://blogbat.com/#webapplication",
        name: "BlogBat",
        applicationCategory: "WebsiteBuilderApplication",
        browserRequirements: "Requires a modern web browser",
        operatingSystem: "Web",
        url: "https://blogbat.com",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      siteFaqGraphNode,
    ],
  };
}

interface ListingArticleRef {
  id: string;
  title: string;
  slug: string;
  canonicalPath?: string;
  category: string;
}

/**
 * Build an `ItemList` JSON-LD node referencing the displayed articles. Uses
 * the `@id` of each article's `mainEntityOfPage` (its canonical URL) so the
 * listing can be joined back to the `BlogPosting` emitted on the detail page.
 */
export function buildArticleItemListSchema(
  articles: ListingArticleRef[],
  siteUrl: string,
  listUrl: string,
) {
  const itemListElement = articles.map((article, index) => {
    const path =
      article.canonicalPath || `/${article.slug.replace(/^\/+|\/+$/g, "")}/`;
    return {
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}${path}`,
      name: article.title,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${listUrl}#itemlist`,
    url: listUrl,
    numberOfItems: articles.length,
    itemListElement,
  };
}

/**
 * Build a `Blog` JSON-LD node for the blog listing page. Used alongside
 * `ItemList` so crawlers understand the page is a blog index.
 */
export function buildBlogListingSchema(
  config: BlogConfig,
  siteUrl: string,
  listUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${listUrl}#blog`,
    url: listUrl,
    name: config.siteName,
    description: config.siteDescription,
    inLanguage: "en-US",
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
  };
}

interface CollectionPageOptions {
  name: string;
  description?: string;
}

/**
 * Build a `CollectionPage` JSON-LD node for category archive pages.
 */
export function buildCollectionPageSchema(
  siteUrl: string,
  listUrl: string,
  options: CollectionPageOptions,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${listUrl}#collection`,
    url: listUrl,
    name: options.name,
    description: options.description,
    inLanguage: "en-US",
    isPartOf: {
      "@id": `${siteUrl}/#website`,
    },
  };
}

export type { ListingArticleRef };
