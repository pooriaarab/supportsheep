import type { Article } from "@repo/types";
import { getArticlePath } from "@/lib/permalinks";
import { normalizePublicDateValue } from "@/lib/public-content";

type ExportArticle = Pick<
  Article,
  | "author"
  | "body"
  | "canonicalPath"
  | "category"
  | "excerpt"
  | "metaDescription"
  | "publishedAt"
  | "slug"
  | "tags"
  | "title"
  | "updatedAt"
>;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeInlineWhitespace(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatInlineHtml(
  html: string,
  format: "markdown" | "text",
): string {
  let output = html;

  output = output.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, text: string) => {
      const label = normalizeInlineWhitespace(text.replace(/<[^>]*>/g, ""));
      if (!label) {
        return "";
      }

      return format === "markdown" ? `[${label}](${href})` : label;
    },
  );

  output = output
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(strong|b|em|i|span|code)[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "");

  return normalizeInlineWhitespace(output);
}

function normalizeBlockWhitespace(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderArticleBody(html: string, format: "markdown" | "text"): string {
  if (!html.trim()) {
    return "";
  }

  let output = html.replace(/\r/g, "");

  output = output.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, content: string) => {
      const heading = formatInlineHtml(content, format);
      if (!heading) {
        return "\n\n";
      }

      if (format === "markdown") {
        return `\n\n${"#".repeat(Math.min(Number(level) + 1, 6))} ${heading}\n\n`;
      }

      return `\n\n${heading}\n\n`;
    },
  );

  output = output.replace(
    /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
    (_, content: string) => {
      const item = formatInlineHtml(content, format);
      return item ? `${format === "markdown" ? "-" : "*"} ${item}\n` : "";
    },
  );

  output = output
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const quote = formatInlineHtml(content, format);
      return quote ? `\n\n> ${quote}\n\n` : "\n\n";
    })
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
      const paragraph = formatInlineHtml(content, format);
      return paragraph ? `\n\n${paragraph}\n\n` : "\n\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return normalizeBlockWhitespace(output);
}

function buildArticleUrl(article: ExportArticle, siteUrl: string): string {
  return `${siteUrl}${getArticlePath(article)}`;
}

function getPreferredSummary(article: ExportArticle): string {
  const metaDescription =
    typeof article.metaDescription === "string" ? article.metaDescription.trim() : "";
  const excerpt = typeof article.excerpt === "string" ? article.excerpt.trim() : "";

  return metaDescription || excerpt;
}

function getDisplayAuthor(article: ExportArticle): string {
  const author = typeof article.author === "string" ? article.author.trim() : "";
  return !author || author.toLowerCase() === "blogblogbatai" ? "Supportsheep" : author;
}

function getTagList(article: ExportArticle): string[] {
  if (!Array.isArray(article.tags)) {
    return [];
  }

  return article.tags.filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  );
}

export function buildArticleMarkdownExport(
  article: ExportArticle,
  siteUrl: string,
): string {
  const articleUrl = buildArticleUrl(article, siteUrl);
  const summary = getPreferredSummary(article);
  const body = renderArticleBody(article.body, "markdown");
  const tags = getTagList(article);
  const lines = [`# ${article.title}`, "", `Source: ${articleUrl}`];

  if (summary) {
    lines.push("", `> ${summary}`);
  }

  lines.push("", `Author: ${getDisplayAuthor(article)}`);
  lines.push(`Category: ${article.category}`);

  const publishedAt = normalizePublicDateValue(article.publishedAt);
  if (publishedAt) {
    lines.push(`Published: ${publishedAt}`);
  }

  const updatedAt = normalizePublicDateValue(article.updatedAt);
  if (updatedAt) {
    lines.push(`Updated: ${updatedAt}`);
  }

  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }

  if (body) {
    lines.push("", body);
  }

  return `${lines.join("\n").trim()}\n`;
}

export function buildArticleLlmsTextExport(
  article: ExportArticle,
  siteUrl: string,
): string {
  const articleUrl = buildArticleUrl(article, siteUrl);
  const summary = getPreferredSummary(article);
  const body = renderArticleBody(article.body, "text");
  const tags = getTagList(article);
  const lines = [
    `# ${article.title}`,
    "",
    `Title: ${article.title}`,
    `URL: ${articleUrl}`,
    `Author: ${getDisplayAuthor(article)}`,
    `Category: ${article.category}`,
  ];

  const publishedAt = normalizePublicDateValue(article.publishedAt);
  if (publishedAt) {
    lines.push(`Published: ${publishedAt}`);
  }

  const updatedAt = normalizePublicDateValue(article.updatedAt);
  if (updatedAt) {
    lines.push(`Updated: ${updatedAt}`);
  }

  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }

  if (summary) {
    lines.push(`Summary: ${summary}`);
  }

  if (body) {
    lines.push("", "Content:", "", body);
  }

  return `${lines.join("\n").trim()}\n`;
}
