import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getBlogConfig } from "@/lib/blog-config";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  getPublicArticleBySlug,
  getPublicCategoryInfo,
  resolveCategorySlug,
  resolveLegacyBlogPath,
} from "@/lib/public-route-resolution";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const normalizedCategory = resolveCategorySlug(category);
  const siteUrl = resolvePublicSiteUrl();
  const blogId = await getRequestBlogId();
  const info = await getPublicCategoryInfo(normalizedCategory, blogId);
  if (info) {
    const config = await getBlogConfig(blogId);
    const resolution = resolveLegacyBlogPath({
      categorySegment: normalizedCategory,
    });
    const canonicalUrl = `${siteUrl}${resolution.destination}`;
    const title = info.displayName;
    const description =
      info.description || `Browse ${info.displayName} articles on ${config.siteName}`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} - ${config.siteName}`,
        description,
        type: "website",
        url: canonicalUrl,
        siteName: config.siteName,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }

  const article = await getPublicArticleBySlug(category, blogId);
  if (article) {
    const articleUrl = `${siteUrl}/${article.slug}`;
    const title = article.metaTitle || article.title;
    const rawDescription = article.metaDescription || article.excerpt || "";
    const description =
      rawDescription.length > 160
        ? rawDescription.slice(0, 157) + "..."
        : rawDescription;

    return {
      title,
      description,
      alternates: {
        canonical: articleUrl,
      },
    };
  }

  return { title: "Not Found" };
}

export default async function LegacyCategoryRoute({ params }: Props) {
  const { category } = await params;
  const normalizedCategory = resolveCategorySlug(category);

  const blogId = await getRequestBlogId();
  const info = await getPublicCategoryInfo(normalizedCategory, blogId);
  if (info) {
    const resolution = resolveLegacyBlogPath({
      categorySegment: normalizedCategory,
    });
    permanentRedirect(resolution.destination);
  }

  const article = await getPublicArticleBySlug(category, blogId);
  if (article) {
    permanentRedirect(`/${article.slug}`);
  }

  notFound();
}
