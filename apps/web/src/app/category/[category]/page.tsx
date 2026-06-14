import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicBlogNav } from "@/components/public/blog-nav";
import { ArticleCard } from "@/components/public/article-card";
import { PublicPagination } from "@/components/public/pagination";
import { PublicShell } from "@/components/public/shell";
import { getBlogConfig } from "@/lib/blog-config";
import {
  getPublicCategoryArticles,
  getPublicCategories,
  getPublicCategoryInfo,
  resolveCategorySlug,
} from "@/lib/public-route-resolution";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import {
  buildArticleItemListSchema,
  buildCollectionPageSchema,
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

// TODO(M5-cache): path-keyed ISR (`revalidate`). Make the cache key host-aware
// before serving distinct tenants on `{slug}.blogbat.com`.
export const revalidate = 300;

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const canonicalCategory = resolveCategorySlug(category);
  const blogId = await getRequestBlogId();
  const info = await getPublicCategoryInfo(canonicalCategory, blogId);
  if (!info) return { title: "Category Not Found" };

  const siteUrl = resolvePublicSiteUrl();
  const categoryUrl = `${siteUrl}/category/${canonicalCategory}`;
  const title = `${info.displayName} — BlogBat`;
  const description =
    info.description || `Browse ${info.displayName} articles on BlogBat`;

  return {
    title: info.displayName,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: categoryUrl,
      siteName: "BlogBat",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: categoryUrl,
    },
  };
}

export default async function CategoryArchivePage({
  params,
  searchParams,
}: Props) {
  const { category } = await params;
  const canonicalCategory = resolveCategorySlug(category);
  if (canonicalCategory !== category) {
    permanentRedirect(`/category/${canonicalCategory}`);
  }
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const perPage = 12;

  const blogId = await getRequestBlogId();
  const [config, info, categories] = await Promise.all([
    getBlogConfig(blogId),
    getPublicCategoryInfo(canonicalCategory, blogId),
    getPublicCategories(blogId),
  ]);

  if (!info) {
    notFound();
  }

  const { articles, hasMore, totalCount } = await getPublicCategoryArticles(
    {
      slug: canonicalCategory,
      displayName: info.displayName,
    },
    page,
    perPage,
    blogId,
  );

  const siteUrl = resolvePublicSiteUrl();
  const articleTheme = resolvePublicArticleTheme(
    config.publicAppearance?.article,
  );
  const categoryUrl = `${siteUrl}/category/${canonicalCategory}`;
  const listUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
  const collectionSchema = buildCollectionPageSchema(siteUrl, categoryUrl, {
    name: info.displayName,
    description: info.description || undefined,
  });
  const itemListSchema = buildArticleItemListSchema(
    articles,
    siteUrl,
    listUrl,
  );

  return (
    <PublicShell config={config} isHomepage={false}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(collectionSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(itemListSchema),
        }}
      />
      <PublicBlogNav categories={categories} activeCategory={canonicalCategory} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-10 rounded-[2rem] border border-border bg-card px-6 py-8 shadow-[0_24px_80px_-52px_rgba(20,24,35,0.5)] sm:px-8">
          <h1 className="font-[family:var(--font-plus-jakarta-sans)] text-3xl font-semibold text-foreground sm:text-4xl">
            {info.displayName}
          </h1>
          {info.description ? (
            <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
              {info.description}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "article" : "articles"}
          </p>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                articleTheme={articleTheme}
              />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            No articles published in this category yet.
          </p>
        )}

        <PublicPagination
          page={page}
          hasMore={hasMore}
          basePath={`/category/${canonicalCategory}`}
        />
      </div>
    </PublicShell>
  );
}
