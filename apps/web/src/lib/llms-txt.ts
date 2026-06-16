import { listPublishedArticles } from "@/lib/articles/repository";
import { getBlogConfig } from "@/lib/blog-config";
import { getArticlePath } from "@/lib/permalinks";
import {
  normalizePublicAuthor,
  normalizePublicBlogConfig,
  normalizePublicDateValue,
} from "@/lib/public-content";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type { Article } from "@repo/types";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type LlmsArticle = Pick<
  Article,
  | "title"
  | "slug"
  | "category"
  | "canonicalPath"
  | "body"
  | "excerpt"
  | "metaDescription"
  | "author"
  | "publishedAt"
  | "tags"
>;

async function loadPublishedArticles(
  limit: number,
  blogId: string,
): Promise<LlmsArticle[]> {
  try {
    const { articles } = await listPublishedArticles(blogId, { limit });
    return articles;
  } catch {
    return [];
  }
}

function articleSummary(article: LlmsArticle): string {
  const meta =
    typeof article.metaDescription === "string"
      ? article.metaDescription.trim()
      : "";
  const excerpt =
    typeof article.excerpt === "string" ? article.excerpt.trim() : "";
  return meta || excerpt;
}

/**
 * Build a spec-compliant llms.txt index (https://llmstxt.org). This is a
 * short overview plus a curated link list grouped by category -- NOT a
 * full article body dump. Target size: well under 100 KB.
 */
export async function buildLlmsTxtIndex(
  blogId: string = DEFAULT_blog_id,
): Promise<string> {
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const siteUrl = resolvePublicSiteUrl();
  const articles = await loadPublishedArticles(150, blogId);

  const lines: string[] = [
    `# ${config.siteName}`,
    "",
    `> ${config.siteDescription}`,
    "",
    `Browse the full site at ${siteUrl}/blog. A machine-readable full-text dump is available at ${siteUrl}/llms-full.txt, and the complete article URL index is available at ${siteUrl}/llms-articles.txt.`,
    "",
  ];

  const grouped = new Map<string, LlmsArticle[]>();
  for (const article of articles) {
    const category = article.category?.trim() || "Articles";
    const bucket = grouped.get(category) ?? [];
    bucket.push(article);
    grouped.set(category, bucket);
  }

  const sortedCategories = Array.from(grouped.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const category of sortedCategories) {
    lines.push(`## ${category}`);
    lines.push("");
    for (const article of grouped.get(category) ?? []) {
      const url = `${siteUrl}${getArticlePath(article)}`;
      const summary = articleSummary(article);
      lines.push(
        summary
          ? `- [${article.title}](${url}): ${summary}`
          : `- [${article.title}](${url})`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Build the full-text llms dump (title + metadata + body per article) at
 * `/llms-full.txt`. Uses `normalizePublicDateValue` +
 * `normalizePublicAuthor` so we never emit `[object Object]` or raw system
 * usernames.
 */
export async function buildLlmsFullTxtContent(
  blogId: string = DEFAULT_blog_id,
): Promise<string> {
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const siteUrl = resolvePublicSiteUrl();
  const articles = await loadPublishedArticles(200, blogId);

  const lines: string[] = [
    `# ${config.siteName}`,
    "",
    `> ${config.siteDescription}`,
    "",
    `Site: ${siteUrl}`,
    "",
    "---",
    "",
  ];

  for (const article of articles) {
    lines.push(`## ${article.title}`);
    lines.push("");
    lines.push(`URL: ${siteUrl}${getArticlePath(article)}`);
    lines.push(`Author: ${normalizePublicAuthor(article.author)}`);
    const publishedAt = normalizePublicDateValue(article.publishedAt);
    if (publishedAt) lines.push(`Published: ${publishedAt}`);
    if (article.tags?.length) lines.push(`Tags: ${article.tags.join(", ")}`);
    lines.push("");
    lines.push(stripHtml(article.body));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build a compact URL-only index for every published article. This gives
 * crawlers complete discovery coverage without making `/llms.txt` too large.
 */
export async function buildLlmsArticleIndexContent(
  blogId: string = DEFAULT_blog_id,
): Promise<string> {
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const siteUrl = resolvePublicSiteUrl();
  const articles = await loadPublishedArticles(1000, blogId);

  const lines: string[] = [
    `# ${config.siteName} Article URL Index`,
    "",
    `> Complete machine-readable URL list for published ${config.siteName} articles.`,
    "",
    `Site: ${siteUrl}`,
    `Total articles: ${articles.length}`,
    `Full-text dump: ${siteUrl}/llms-full.txt`,
    `RSS feed: ${siteUrl}/api/feed`,
    "",
  ];

  for (const article of articles) {
    const url = `${siteUrl}${getArticlePath(article)}`;
    const publishedAt = normalizePublicDateValue(article.publishedAt);
    lines.push(`- [${article.title}](${url})`);
    lines.push(`  Category: ${article.category?.trim() || "Articles"}`);
    if (publishedAt) lines.push(`  Published: ${publishedAt}`);
    const summary = articleSummary(article);
    if (summary) lines.push(`  Summary: ${summary}`);
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Backwards-compatible alias. Previously served a full-body dump at
 * `/llms.txt`; now callers should choose between {@link buildLlmsTxtIndex}
 * (spec-compliant overview) and {@link buildLlmsFullTxtContent} (full dump).
 * @deprecated Use {@link buildLlmsTxtIndex} or {@link buildLlmsFullTxtContent}.
 */
export const buildLlmsTxtContent = buildLlmsFullTxtContent;
