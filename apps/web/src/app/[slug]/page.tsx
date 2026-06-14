import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/public/article-page";
import { PublicShell } from "@/components/public/shell";
import { getBlogConfig } from "@/lib/blog-config";
import { isReservedRootSlug } from "@/lib/permalinks";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  getPublicArticleBySlug,
  getPublicAuthorBySlug,
  getPublicCategories,
  getRelatedPublicArticles,
} from "@/lib/public-route-resolution";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedRootSlug(slug)) {
    return { title: "Not Found" };
  }

  const blogId = await getRequestBlogId();
  const article = await getPublicArticleBySlug(slug, blogId);

  if (!article) {
    return { title: "Not Found" };
  }

  const config = await getBlogConfig(blogId);
  const siteUrl = resolvePublicSiteUrl();
  const articleUrl = `${siteUrl}/${slug}`;
  const title = article.metaTitle || article.title;
  const rawDescription = article.metaDescription || article.excerpt || "";
  const description =
    rawDescription.length > 160
      ? rawDescription.slice(0, 157) + "..."
      : rawDescription;
  const imageUrl =
    article.ogImage || article.featuredImage?.url || undefined;
  const ogImages = imageUrl
    ? [{ url: imageUrl, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    title,
    description,
    keywords: article.keywords,
    openGraph: {
      title,
      description,
      type: "article",
      url: articleUrl,
      images: ogImages,
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      authors: article.author ? [article.author] : undefined,
      section: article.category,
      tags: article.tags,
      siteName: config.siteName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    alternates: {
      canonical: articleUrl,
    },
  };
}

export default async function RootArticlePage({ params }: Props) {
  const { slug } = await params;

  if (isReservedRootSlug(slug)) {
    notFound();
  }

  const blogId = await getRequestBlogId();
  const article = await getPublicArticleBySlug(slug, blogId);
  if (!article) {
    notFound();
  }

  const config = await getBlogConfig(blogId);
  const articleTheme = resolvePublicArticleTheme(
    config.publicAppearance?.article,
  );
  const siteUrl = resolvePublicSiteUrl();
  const [relatedArticles, categories, author] = await Promise.all([
    getRelatedPublicArticles(article, blogId),
    getPublicCategories(blogId),
    article.authorId ? getPublicAuthorBySlug(article.authorId, blogId) : null,
  ]);

  return (
    <PublicShell config={config} isHomepage={false}>
      <ArticlePage
        article={article}
        relatedArticles={relatedArticles}
        categories={categories}
        siteUrl={siteUrl}
        articleTheme={articleTheme}
        author={author}
      />
    </PublicShell>
  );
}
