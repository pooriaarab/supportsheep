import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorPage } from "@/components/public/author-page";
import { getAuthorPath } from "@/lib/authors";
import { getBlogConfig } from "@/lib/blog-config";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import {
  getPublicAuthorArticles,
  getPublicAuthorBySlug,
  getAllPublicAuthors,
} from "@/lib/public-route-resolution";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

// TODO(M5-cache): path-keyed ISR (`revalidate`) + `generateStaticParams` are
// keyed by author slug under the default blog. Make both host-aware before
// serving distinct tenants on `{slug}.supportsheep.com`.
export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const blogId = await getRequestBlogId();
  const author = await getPublicAuthorBySlug(slug, blogId);
  if (!author) {
    return { title: "Author Not Found" };
  }

  const siteUrl = resolvePublicSiteUrl();
  const authorUrl = `${siteUrl}${getAuthorPath(author.id)}`;
  const description =
    author.bio || `Articles written by ${author.name} on Supportsheep`;

  return {
    title: author.name,
    description,
    openGraph: {
      title: author.name,
      description,
      type: "profile",
      url: authorUrl,
      images: author.avatarUrl
        ? [{ url: author.avatarUrl, alt: author.name }]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: author.name,
      description,
    },
    alternates: {
      canonical: authorUrl,
    },
  };
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const authors = await getAllPublicAuthors();
    return authors.map((author) => ({ slug: author.id }));
  } catch {
    return [];
  }
}

export default async function AuthorArchivePage({ params }: Props) {
  const { slug } = await params;
  const blogId = await getRequestBlogId();
  const author = await getPublicAuthorBySlug(slug, blogId);
  if (!author) {
    notFound();
  }

  const siteUrl = resolvePublicSiteUrl();
  const [articles, config] = await Promise.all([
    getPublicAuthorArticles(author.id, 50, blogId),
    getBlogConfig(blogId),
  ]);
  const articleTheme = resolvePublicArticleTheme(
    config.publicAppearance?.article,
  );

  return (
    <AuthorPage
      author={author}
      articles={articles}
      siteUrl={siteUrl}
      articleTheme={articleTheme}
    />
  );
}
