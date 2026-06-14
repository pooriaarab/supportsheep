/**
 * Root Page — Public Blog Homepage
 *
 * The root `/` renders the public blog with the configurable layout
 * (grid/sidebar/hybrid from admin settings), fetches published articles
 * with pagination, and wraps everything in the public header + footer.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getBlogConfig } from "@/lib/blog-config";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { isMarketingHost } from "@/lib/tenancy/host-resolution";
import { PublicBlogNav } from "@/components/public/blog-nav";
import { GridLayout } from "@/components/public/layouts/grid-layout";
import { SidebarLayout } from "@/components/public/layouts/sidebar-layout";
import { HybridLayout } from "@/components/public/layouts/hybrid-layout";
import { PublicShell } from "@/components/public/shell";
import { normalizePublicBlogConfig } from "@/lib/public-content";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { getPublicCategories } from "@/lib/public-route-resolution";
import { listPublishedArticles } from "@/lib/articles/repository";
import {
  getRequestBlogId,
  resolveRequestTenant,
} from "@/lib/tenancy/request-blog";
import {
  buildArticleItemListSchema,
  buildBlogListingSchema,
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

// TODO(M5-cache): this page is path-keyed ISR (`revalidate`). Once real
// `{slug}.blogbat.com` subdomains serve distinct tenants, a path-only cache key
// (`/`) would serve one tenant's homepage to another. Make the ISR cache key
// host-aware before enabling multi-tenant subdomain traffic.
export const revalidate = 300;

/**
 * Whether the current request targets the BlogBat marketing site (apex / `www`).
 *
 * Reads the host from request headers the same way as {@link getRequestBlogId}
 * (`x-bb-host` set by middleware, falling back to `host`). Never throws: if the
 * host is unavailable or ambiguous, returns `false` so the tenant-blog homepage
 * renders by default.
 */
async function isMarketingRequest(): Promise<boolean> {
  try {
    const headerList = await headers();
    const host = headerList.get("x-bb-host") ?? headerList.get("host") ?? "";
    return isMarketingHost(host);
  } catch {
    return false;
  }
}

const MARKETING_TITLE = "Supportsheep — The AI-native support platform with Real-time Voice";
const MARKETING_DESCRIPTION =
  "Give your customers instant answers via Chat and Voice. Supportsheep builds your knowledge base and serves it instantly.";

function marketingMetadata(): Metadata {
  const url = "https://supportsheep.com";
  return {
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    openGraph: {
      title: MARKETING_TITLE,
      description: MARKETING_DESCRIPTION,
      type: "website",
      url,
      siteName: "Supportsheep",
    },
    twitter: {
      card: "summary_large_image",
      title: MARKETING_TITLE,
      description: MARKETING_DESCRIPTION,
    },
    alternates: { canonical: url },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isMarketingRequest()) return marketingMetadata();

  const blogId = await getRequestBlogId();
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const siteUrl = resolvePublicSiteUrl();
  const title = config.seo.defaultMetaTitle || config.siteName;
  const description =
    config.seo.defaultMetaDescription || config.siteDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: siteUrl,
      siteName: config.siteName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: siteUrl,
    },
  };
}

async function getPublishedArticles(
  page: number,
  perPage: number,
  blogId: string,
) {
  try {
    const offset = (page - 1) * perPage;
    return await listPublishedArticles(blogId, { limit: perPage, offset });
  } catch {
    return { articles: [], hasMore: false };
  }
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function Page({ searchParams }: Props) {
  // An unknown `*.blogbat.com` tenant subdomain must 404 rather than silently
  // serving the default blog. Marketing/default hosts render as before.
  const tenant = await resolveRequestTenant();
  if (tenant.kind === "not-found") {
    notFound();
  }
  if (tenant.kind === "marketing" && (await isMarketingRequest())) {
    return <MarketingHome />;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const blogId =
    tenant.kind === "blog" ? tenant.blogId : await getRequestBlogId();
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const perPage = config.homepage.postsPerPage || 12;

  const [{ articles, hasMore }, categories] = await Promise.all([
    getPublishedArticles(page, perPage, blogId),
    getPublicCategories(blogId),
  ]);

  const layout = config.homepage.layout || "grid";
  const heading = config.siteName;
  const description = config.siteDescription;
  const articleTheme = resolvePublicArticleTheme(
    config.publicAppearance?.article,
  );

  const siteUrl = resolvePublicSiteUrl();
  const listUrl = page === 1 ? siteUrl : `${siteUrl}/?page=${page}`;
  const itemListSchema = buildArticleItemListSchema(
    articles,
    siteUrl,
    listUrl,
  );
  const blogSchema = buildBlogListingSchema(config, siteUrl, siteUrl);

  let content: React.ReactNode;
  if (layout === "sidebar") {
    content = (
      <SidebarLayout
        articles={articles}
        categories={categories}
        page={page}
        hasMore={hasMore}
        basePath="/"
        heading={heading}
        description={description}
        articleTheme={articleTheme}
      />
    );
  } else if (layout === "hybrid") {
    content = (
      <HybridLayout
        articles={articles}
        page={page}
        hasMore={hasMore}
        basePath="/"
        heading={heading}
        description={description}
        articleTheme={articleTheme}
      />
    );
  } else {
    content = (
      <GridLayout
        articles={articles}
        page={page}
        hasMore={hasMore}
        basePath="/"
        heading={heading}
        description={description}
        articleTheme={articleTheme}
      />
    );
  }

  return (
    <PublicShell config={config} isHomepage={true}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(blogSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(itemListSchema),
        }}
      />
      <PublicBlogNav categories={categories} />
      {content}
    </PublicShell>
  );
}
