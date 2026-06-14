import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getBlogConfig } from "@/lib/blog-config";
import { getPublicArticleBySlug } from "@/lib/public-route-resolution";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const blogId = await getRequestBlogId();
  const article = await getPublicArticleBySlug(slug, blogId);
  if (!article) return { title: "Not Found" };

  const config = await getBlogConfig(blogId);
  const siteUrl = resolvePublicSiteUrl();
  const articleUrl = `${siteUrl}/${article.slug}`;
  const title = article.metaTitle || article.title;
  const rawDescription = article.metaDescription || article.excerpt || "";
  const description =
    rawDescription.length > 160
      ? rawDescription.slice(0, 157) + "..."
      : rawDescription;
  const imageUrl = article.ogImage || article.featuredImage?.url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: articleUrl,
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: title }]
        : undefined,
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

export default async function LegacyArticleRoute({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/${slug}`);
}
