/**
 * Public Blog Homepage
 *
 * Fetches blog config for the selected layout (grid/sidebar/hybrid),
 * fetches published articles with pagination, and renders the appropriate layout.
 */

import type { Metadata } from "next";
import { getBlogConfig } from "@/lib/blog-config";
import { PublicBlogNav } from "@/components/public/blog-nav";
import { GridLayout } from "@/components/public/layouts/grid-layout";
import { SidebarLayout } from "@/components/public/layouts/sidebar-layout";
import { HybridLayout } from "@/components/public/layouts/hybrid-layout";
import { normalizePublicBlogConfig } from "@/lib/public-content";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { getPublicCategories } from "@/lib/public-route-resolution";
import { listPublishedArticles } from "@/lib/articles/repository";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import {
  buildArticleItemListSchema,
  buildBlogListingSchema,
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

// TODO(M5-cache): path-keyed ISR (`revalidate`). Make the cache key host-aware
// before serving distinct tenants on `{slug}.blogbat.com` (a `/blog` key alone
// would leak one tenant's listing to another).
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
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
      url: `${siteUrl}/blog`,
      siteName: config.siteName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${siteUrl}/blog`,
    },
  };
}

async function getPublishedArticles(
  page: number,
  perPage: number,
  blogId: string,
) {
  const offset = (page - 1) * perPage;
  return listPublishedArticles(blogId, { limit: perPage, offset });
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogHomePage({ searchParams }: Props) {
  const blogId = await getRequestBlogId();
  const [params, rawConfig] = await Promise.all([
    searchParams,
    getBlogConfig(blogId),
  ]);
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const config = normalizePublicBlogConfig(rawConfig);
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
  const listUrl =
    page === 1 ? `${siteUrl}/blog` : `${siteUrl}/blog?page=${page}`;
  const blogSchema = buildBlogListingSchema(config, siteUrl, `${siteUrl}/blog`);
  const itemListSchema = buildArticleItemListSchema(
    articles,
    siteUrl,
    listUrl,
  );

  const listingJsonLd = (
    <>
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
    </>
  );

  if (layout === "sidebar") {
    return (
      <>
        {listingJsonLd}
        <PublicBlogNav categories={categories} />
        <SidebarLayout
          articles={articles}
          categories={categories}
          page={page}
          hasMore={hasMore}
          basePath="/blog"
          heading={heading}
          description={description}
          articleTheme={articleTheme}
        />
      </>
    );
  }

  if (layout === "hybrid") {
    return (
      <>
        {listingJsonLd}
        <PublicBlogNav categories={categories} />
        <HybridLayout
          articles={articles}
          page={page}
          hasMore={hasMore}
          basePath="/blog"
          heading={heading}
          description={description}
          articleTheme={articleTheme}
        />
      </>
    );
  }

  return (
    <>
      {listingJsonLd}
      <PublicBlogNav categories={categories} />
      <GridLayout
        articles={articles}
        page={page}
        hasMore={hasMore}
        basePath="/blog"
        heading={heading}
        description={description}
        articleTheme={articleTheme}
      />
    </>
  );
}
