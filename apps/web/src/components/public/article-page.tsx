import Image from "next/image";
import Link from "next/link";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";
import { renderArticleBodySafely } from "@/components/public/article-body";
import { ArticleCard } from "@/components/public/article-card";
import { TableOfContents } from "@/components/public/toc";
import { buildAuthorPersonSchema, getAuthorPath } from "@/lib/authors";
import { createLogger } from "@/lib/logger";
import {
  getArticlePath,
  getCategoryPath,
  getPrimaryCategory,
} from "@/lib/permalinks";
import { stringifyJsonLdForScript } from "@/lib/public-site";
import {
  resolvePublicArticleTheme,
  type ResolvedPublicArticleTheme,
} from "@/lib/public-article-theme";
import { cn } from "@/lib/utils";
import { FeedbackWidget } from "@/components/public/feedback-widget";
import {
  AI_DISCLOSURE_TEXT,
  stripLeadingAiDisclosure,
} from "@/lib/articles/prepend-ai-disclosure";
import type { Article, Author, CategoryEntry } from "@repo/types";

const articleRenderLogger = createLogger("public.article-page");

interface CategoryWithSlug extends CategoryEntry {
  slug: string;
}

interface ArticlePageProps {
  article: Article & { id: string };
  relatedArticles: (Article & { id: string })[];
  categories: CategoryWithSlug[];
  siteUrl: string;
  articleTheme?: ResolvedPublicArticleTheme;
  /**
   * Optional resolved author for the article. When provided, takes precedence
   * over the legacy {@link Article.author} string for both the visible byline
   * and the `BlogPosting.author` JSON-LD entry.
   */
  author?: Author | null;
}

function getDisplayAuthor(author?: string | null) {
  if (!author || author.toLowerCase() === "blogsupportsheepai") {
    return "Supportsheep";
  }

  return author;
}

function getStructuredAuthor(
  author: Author | null | undefined,
  fallbackName: string | null | undefined,
  siteUrl: string,
) {
  if (author) {
    return buildAuthorPersonSchema(author, siteUrl);
  }

  const name = getDisplayAuthor(fallbackName);

  if (name === "Supportsheep") {
    return {
      "@type": "Organization" as const,
      name,
    };
  }

  return {
    "@type": "Person" as const,
    name,
  };
}

function getKeywordList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const keywords = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );

  return keywords.length > 0 ? keywords : undefined;
}

/**
 * Coerce a date-ish value (ISO string or Firestore Timestamp shape) into a
 * millisecond epoch. Returns `null` for unrecognized / unparseable inputs so
 * callers can skip the comparison instead of treating them as epoch zero.
 */
function toEpochMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value) {
      const ms = (value as { toDate: () => Date }).toDate().getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if ("seconds" in value) {
      const seconds = (value as { seconds: number }).seconds;
      if (typeof seconds === "number") return seconds * 1000;
    }
    if ("_seconds" in value) {
      const seconds = (value as { _seconds: number })._seconds;
      if (typeof seconds === "number") return seconds * 1000;
    }
  }
  return null;
}

/**
 * Decide whether the article's "Updated" date should appear alongside
 * the publish date. Trivial edits soon after publication shouldn't flip
 * the byline, so we require the `updatedAt` to be at least 24 hours later
 * than `publishedAt` (or `createdAt` when unpublished).
 */
function shouldShowUpdatedDate(
  publishedAt: unknown,
  updatedAt: unknown,
): boolean {
  const published = toEpochMillis(publishedAt);
  const updated = toEpochMillis(updatedAt);
  if (published === null || updated === null) return false;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return updated - published >= ONE_DAY_MS;
}

function formatDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  }
  if (typeof value === "string") {
    return new Date(value).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return "";
}

/**
 * Normalize a date value to an ISO 8601 string for JSON-LD output. The
 * canonical {@link Article} type stores dates as strings, but Firestore
 * Timestamps can leak through at runtime (same guard as {@link formatDate}).
 * Returns `undefined` when the value is missing or unrecognized so callers
 * can omit the field rather than emit `{}`. String inputs are re-parsed
 * through `new Date` so that malformed Firestore values do not leak
 * unvalidated into structured data output.
 */
function toIsoDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return new Date(value).toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if ("seconds" in value) {
      const seconds = (value as { seconds: number }).seconds;
      if (typeof seconds === "number") {
        return new Date(seconds * 1000).toISOString();
      }
    }
    if ("_seconds" in value) {
      const seconds = (value as { _seconds: number })._seconds;
      if (typeof seconds === "number") {
        return new Date(seconds * 1000).toISOString();
      }
    }
  }
  return undefined;
}

/**
 * Extract unique YouTube video IDs referenced in an article body. Handles
 * embed/share/watch URL shapes produced by the TipTap YouTube extension
 * as well as raw URLs copy-pasted into HTML.
 */
function extractYouTubeVideoIds(body: string): string[] {
  if (!body) return [];
  const ids = new Set<string>();
  // YouTube video IDs are always exactly 11 characters (URL-safe base64).
  const patterns = [
    /(?:youtube(?:-nocookie)?\.com)\/embed\/([A-Za-z0-9_-]{11})/g,
    /youtu\.be\/([A-Za-z0-9_-]{11})/g,
    /(?:youtube\.com)\/watch\?[^"'\s]*?v=([A-Za-z0-9_-]{11})/g,
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) {
      const id = match[1];
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

function VideoObjectJsonLd({
  article,
  videoIds,
}: {
  article: Article & { id: string };
  videoIds: string[];
}) {
  if (videoIds.length === 0) return null;

  const uploadDate = toIsoDateString(article.publishedAt || article.createdAt);
  const description = article.metaDescription || article.excerpt || article.title;

  return (
    <>
      {videoIds.map((id) => {
        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: article.title,
          description,
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${id}`,
          contentUrl: `https://www.youtube.com/watch?v=${id}`,
        };
        if (uploadDate) {
          jsonLd.uploadDate = uploadDate;
        }
        return (
          <script
            key={id}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: stringifyJsonLdForScript(jsonLd),
            }}
          />
        );
      })}
    </>
  );
}

interface FaqEntry {
  question: string;
  answer: string;
}

// Locate the opening `<section class="...faq...">` tag; the matching
// `</section>` is found separately via `findFaqSectionInner` which tracks
// nested `<section>` depth. The editor schema (`faq` only allows `faqItem+`)
// guarantees no nested sections today, but we do not want a future schema
// change or hand-authored HTML to silently truncate the extracted content.
// TipTap always serialises class names in lowercase, so no `i` flag is needed.
const FAQ_SECTION_OPEN_REGEX =
  /<section\b[^>]*\bclass=(?:"[^"]*\bfaq\b[^"]*"|'[^']*\bfaq\b[^']*')[^>]*>/g;
const FAQ_ITEM_SPLIT_REGEX =
  /<div\b[^>]*\bclass=(?:"[^"]*\bfaq-item\b[^"]*"|'[^']*\bfaq-item\b[^']*')[^>]*>/;
const FAQ_QUESTION_REGEX =
  /<h3\b[^>]*\bclass=(?:"[^"]*\bfaq-question\b[^"]*"|'[^']*\bfaq-question\b[^']*')[^>]*>([\s\S]*?)<\/h3>/;
const FAQ_ANSWER_OPEN_REGEX =
  /<div\b[^>]*\bclass=(?:"[^"]*\bfaq-answer\b[^"]*"|'[^']*\bfaq-answer\b[^']*')[^>]*>/;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  // Convert block-level closings to spaces so adjacent paragraphs don't fuse
  // into a single word, then strip remaining tags without injecting whitespace
  // (which would break "First question?" -> "First question ?").
  const withBlockBreaks = html.replace(
    /<\/(p|div|li|ul|ol|h[1-6]|br|blockquote)\s*\/?>/g,
    " ",
  );
  return decodeBasicEntities(withBlockBreaks.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the inner HTML of a `section.faq` by tracking nested `<section>`
 * balance, so articles containing nested sections inside a FAQ block (e.g.
 * from future schema changes or hand-authored HTML) still resolve cleanly
 * instead of being truncated at the first `</section>`.
 */
function findFaqSectionInner(
  body: string,
  contentStart: number,
): { inner: string; end: number } {
  let depth = 1;
  const tagRegex = /<(\/?)section\b[^>]*>/g;
  tagRegex.lastIndex = contentStart;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(body)) !== null) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        return {
          inner: body.slice(contentStart, match.index),
          end: match.index + match[0].length,
        };
      }
    } else {
      depth += 1;
    }
  }
  // Unterminated section: treat the rest of the body as the inner content.
  return { inner: body.slice(contentStart), end: body.length };
}

/**
 * Extract the inner HTML of a `.faq-answer` div by tracking nested `<div>`
 * balance, so answers containing nested divs still resolve cleanly.
 */
function extractFaqAnswerInner(itemBody: string): string {
  const openMatch = FAQ_ANSWER_OPEN_REGEX.exec(itemBody);
  if (!openMatch) return "";
  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  const tagRegex = /<(\/?)div\b[^>]*>/g;
  tagRegex.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(itemBody)) !== null) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth === 0) return itemBody.slice(start, match.index);
    } else {
      depth += 1;
    }
  }
  return itemBody.slice(start);
}

/**
 * Parse FAQ entries out of an article body by scanning for `section.faq` blocks
 * and their nested `.faq-item` entries. Returns deduplicated, non-empty pairs.
 */
export function extractFaqEntries(body: string): FaqEntry[] {
  if (!body || !/faq-item/.test(body)) return [];

  const entries: FaqEntry[] = [];
  const seen = new Set<string>();

  FAQ_SECTION_OPEN_REGEX.lastIndex = 0;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = FAQ_SECTION_OPEN_REGEX.exec(body)) !== null) {
    const contentStart = openMatch.index + openMatch[0].length;
    const { inner, end } = findFaqSectionInner(body, contentStart);
    // Advance the outer iterator past this section so we don't redundantly
    // re-scan matches inside the section we just consumed.
    FAQ_SECTION_OPEN_REGEX.lastIndex = end;

    // Split on each item's opening tag so each chunk from index 1 onward
    // contains one item's inner markup.
    const itemChunks = inner.split(FAQ_ITEM_SPLIT_REGEX);
    // First chunk is pre-item content; subsequent chunks each contain one item body.
    for (let i = 1; i < itemChunks.length; i += 1) {
      const itemBody = itemChunks[i];
      const question = stripTags(
        FAQ_QUESTION_REGEX.exec(itemBody)?.[1] ?? "",
      );
      const answer = stripTags(extractFaqAnswerInner(itemBody));
      if (!question || !answer) continue;
      const key = `${question}::${answer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ question, answer });
    }
  }

  // Reset the section iterator's `lastIndex` to guard against leaking state
  // if future edits change the iteration. `FAQ_ITEM_SPLIT_REGEX` is not
  // global, so `split` does not track `lastIndex` on it.
  FAQ_SECTION_OPEN_REGEX.lastIndex = 0;

  return entries;
}

/**
 * Title-case a category slug (e.g. "website-tips" → "Website Tips"). Used as a
 * fallback for `articleSection` when a display name is not available so we do
 * not emit raw slugs in structured data.
 */
function titleCaseSlug(value: string): string {
  return value
    .split(/[-_\s]+/)
    .flatMap((part) =>
      part ? [part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()] : [],
    )
    .join(" ");
}

interface HowToStepEntry {
  name: string;
  text: string;
}

// Locate the opening `<section class="...howto...">` tag; the matching
// `</section>` is found separately via `findHowToSectionInner` which tracks
// nested `<section>` depth. The editor schema (`howto` only allows
// `howtoStep+`) guarantees no nested sections today, but we do not want a
// future schema change or hand-authored HTML to silently truncate the
// extracted content. TipTap always serialises class names in lowercase, so no
// `i` flag is needed.
const HOWTO_SECTION_OPEN_REGEX =
  /<section\b[^>]*\bclass=(?:"[^"]*\bhowto\b[^"]*"|'[^']*\bhowto\b[^']*')[^>]*>/g;
const HOWTO_STEP_SPLIT_REGEX =
  /<li\b[^>]*\bclass=(?:"[^"]*\bhowto-step\b[^"]*"|'[^']*\bhowto-step\b[^']*')[^>]*>/;
const HOWTO_STEP_NAME_REGEX =
  /<h3\b[^>]*\bclass=(?:"[^"]*\bhowto-step-name\b[^"]*"|'[^']*\bhowto-step-name\b[^']*')[^>]*>([\s\S]*?)<\/h3>/;
const HOWTO_STEP_CONTENT_OPEN_REGEX =
  /<div\b[^>]*\bclass=(?:"[^"]*\bhowto-step-content\b[^"]*"|'[^']*\bhowto-step-content\b[^']*')[^>]*>/;

/**
 * Extract the inner HTML of a `section.howto` by tracking nested `<section>`
 * balance, so articles containing nested sections inside a HowTo block still
 * resolve cleanly instead of being truncated at the first `</section>`.
 */
function findHowToSectionInner(
  body: string,
  contentStart: number,
): { inner: string; end: number } {
  let depth = 1;
  const tagRegex = /<(\/?)section\b[^>]*>/g;
  tagRegex.lastIndex = contentStart;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(body)) !== null) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        return {
          inner: body.slice(contentStart, match.index),
          end: match.index + match[0].length,
        };
      }
    } else {
      depth += 1;
    }
  }
  return { inner: body.slice(contentStart), end: body.length };
}

/**
 * Extract the inner HTML of a `.howto-step-content` div by tracking nested
 * `<div>` balance, so step content containing nested divs still resolves
 * cleanly.
 */
function extractHowToStepContentInner(stepBody: string): string {
  const openMatch = HOWTO_STEP_CONTENT_OPEN_REGEX.exec(stepBody);
  if (!openMatch) return "";
  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  const tagRegex = /<(\/?)div\b[^>]*>/g;
  tagRegex.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(stepBody)) !== null) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth === 0) return stepBody.slice(start, match.index);
    } else {
      depth += 1;
    }
  }
  return stepBody.slice(start);
}

/**
 * Parse HowTo steps out of an article body by scanning for `section.howto`
 * blocks and their nested `.howto-step` entries. Returns deduplicated,
 * non-empty name/text pairs.
 */
export function extractHowToSteps(body: string): HowToStepEntry[] {
  if (!body || !/howto-step/.test(body)) return [];

  const entries: HowToStepEntry[] = [];
  const seen = new Set<string>();

  HOWTO_SECTION_OPEN_REGEX.lastIndex = 0;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = HOWTO_SECTION_OPEN_REGEX.exec(body)) !== null) {
    const contentStart = openMatch.index + openMatch[0].length;
    const { inner, end } = findHowToSectionInner(body, contentStart);
    HOWTO_SECTION_OPEN_REGEX.lastIndex = end;

    const stepChunks = inner.split(HOWTO_STEP_SPLIT_REGEX);
    for (let i = 1; i < stepChunks.length; i += 1) {
      const stepBody = stepChunks[i];
      const name = stripTags(
        HOWTO_STEP_NAME_REGEX.exec(stepBody)?.[1] ?? "",
      );
      const text = stripTags(extractHowToStepContentInner(stepBody));
      if (!name || !text) continue;
      const key = `${name}::${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ name, text });
    }
  }

  HOWTO_SECTION_OPEN_REGEX.lastIndex = 0;

  return entries;
}

function ArticleJsonLd({
  article,
  siteUrl,
  categoryDisplayName,
  author,
}: {
  article: Article & { id: string };
  siteUrl: string;
  categoryDisplayName?: string;
  author?: Author | null;
}) {
  const canonicalUrl = `${siteUrl}${getArticlePath(article)}`;
  const primaryCategory = getPrimaryCategory(article);
  const categoryPath = getCategoryPath(primaryCategory || "uncategorized");
  const keywords = getKeywordList(article.keywords);
  const featuredImageRaw = article.featuredImage;
  const featuredImage =
    featuredImageRaw && typeof featuredImageRaw === "object"
      ? featuredImageRaw
      : null;
  const imageUrl =
    article.ogImage || featuredImage?.url || `${siteUrl}/og.png`;
  const useFeaturedDimensions = !article.ogImage && !!featuredImage?.url;
  const imageObject = {
    "@type": "ImageObject" as const,
    url: imageUrl,
    width: useFeaturedDimensions ? (featuredImage?.width ?? 1200) : 1200,
    height: useFeaturedDimensions ? (featuredImage?.height ?? 630) : 630,
  };
  const articleSection =
    categoryDisplayName ||
    (primaryCategory ? titleCaseSlug(primaryCategory) : undefined);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    image: imageObject,
    url: canonicalUrl,
    inLanguage: "en-US",
    articleSection,
    datePublished: toIsoDateString(article.publishedAt || article.createdAt),
    dateModified: toIsoDateString(article.updatedAt),
    author: getStructuredAuthor(author, article.author, siteUrl),
    publisher: {
      "@type": "Organization",
      name: "Supportsheep",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.png`,
        width: 112,
        height: 112,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".article-summary", ".article-excerpt", "article h1"],
    },
    wordCount: article.wordCount,
    keywords: keywords?.join(", "),
  };

  const faqEntries = safeExtractFaqEntries(article.id, article.body);
  const faqJsonLd =
    faqEntries.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqEntries.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: entry.answer,
            },
          })),
        }
      : null;

  const howToSteps = extractHowToSteps(article.body);
  const howToJsonLd =
    howToSteps.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: article.title,
          description: article.metaDescription || article.excerpt || undefined,
          step: howToSteps.map((entry) => ({
            "@type": "HowToStep",
            name: entry.name,
            text: entry.text,
          })),
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryDisplayName || primaryCategory,
        item: `${siteUrl}${categoryPath}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLdForScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(breadcrumbJsonLd),
        }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: stringifyJsonLdForScript(faqJsonLd),
          }}
        />
      ) : null}
      {howToJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: stringifyJsonLdForScript(howToJsonLd),
          }}
        />
      ) : null}
    </>
  );
}

// `renderArticleBodySafely` lives in `./article-body` so the shared
// `ArticleBodyRenderer` can reuse the same sanitize + heading-id transform
// pipeline. It is re-exported here for the existing test surface.
export { renderArticleBodySafely };

function safeExtractYouTubeVideoIds(articleId: string, body: string): string[] {
  try {
    return extractYouTubeVideoIds(body);
  } catch (error) {
    articleRenderLogger.error("extractYouTubeVideoIds failed; omitting video JSON-LD", {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function safeExtractFaqEntries(articleId: string, body: string): FaqEntry[] {
  try {
    return extractFaqEntries(body);
  } catch (error) {
    articleRenderLogger.error("extractFaqEntries failed; omitting FAQ JSON-LD", {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function ArticlePage({
  article,
  relatedArticles,
  categories,
  siteUrl,
  articleTheme,
  author,
}: ArticlePageProps) {
  const resolvedArticleTheme = articleTheme ?? resolvePublicArticleTheme(undefined);
  const articleTags = Array.isArray(article.tags) ? article.tags : [];
  const publishedDateSource = article.publishedAt ?? article.createdAt;
  const date = formatDate(publishedDateSource);
  const showUpdated = shouldShowUpdatedDate(
    publishedDateSource,
    article.updatedAt,
  );
  const updatedDate = showUpdated ? formatDate(article.updatedAt) : "";
  const summary =
    typeof article.summary === "string" ? article.summary.trim() : "";
  const primaryCategoryLabel = getPrimaryCategory(article);
  const categorySlug = primaryCategoryLabel
    ? getCategoryPath(primaryCategoryLabel)
    : null;
  const categoryDisplayName = primaryCategoryLabel
    ? categories.find(
        (category) => category.slug === categorySlug?.split("/").pop(),
      )?.displayName
    : undefined;
  const displayAuthor = author?.name ?? getDisplayAuthor(article.author);
  const authorHref = author ? getAuthorPath(author.id) : null;
  const { body: articleBodyWithoutDisclosure } = stripLeadingAiDisclosure(
    article.body,
  );
  // The body is rendered via `<ArticleBodyRenderer>` below, which runs the
  // same sanitize + heading-id pipeline. We still call it here to extract
  // the heading list for the sticky `<TableOfContents>` sibling.
  const { headings: articleHeadings } = renderArticleBodySafely(
    article.id,
    articleBodyWithoutDisclosure,
  );
  const youTubeVideoIds = safeExtractYouTubeVideoIds(
    article.id,
    articleBodyWithoutDisclosure,
  );
  const featuredImageRaw = article.featuredImage;
  const featuredImage =
    featuredImageRaw && typeof featuredImageRaw === "object"
      ? featuredImageRaw
      : null;
  const featuredImageUrl = featuredImage?.url ?? "";
  const featuredImageAlt = featuredImage?.alt || article.title;

  return (
    <>
      <ArticleJsonLd
        article={article}
        siteUrl={siteUrl}
        categoryDisplayName={categoryDisplayName}
        author={author}
      />
      <VideoObjectJsonLd article={article} videoIds={youTubeVideoIds} />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <article
            className={cn(
              "min-w-0",
              resolvedArticleTheme.typography.bodyFontClassName,
            )}
            style={resolvedArticleTheme.readingLayout.contentContainerStyle}
          >
            <nav className="mb-7 text-sm text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">
                Blog
              </Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">{article.title}</span>
            </nav>

            <header className="mb-10">
              <h1
                className={cn(
                  "font-semibold leading-tight text-foreground",
                  resolvedArticleTheme.typography.headingFontClassName,
                  resolvedArticleTheme.typography.pageTitleClassName,
                )}
              >
                {article.title}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {authorHref ? (
                  <Link
                    href={authorHref}
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    {author?.avatarUrl ? (
                      <Image
                        src={author.avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6 rounded-full border border-border object-cover"
                      />
                    ) : null}
                    <span>{displayAuthor}</span>
                  </Link>
                ) : (
                  <span>{displayAuthor}</span>
                )}
                {date ? (
                  <time dateTime={article.publishedAt ?? article.createdAt}>
                    Published: {date}
                  </time>
                ) : null}
                {updatedDate ? (
                  <time dateTime={article.updatedAt}>
                    Updated: {updatedDate}
                  </time>
                ) : null}
                {article.readingTime > 0 ? (
                  <span>{article.readingTime} min read</span>
                ) : null}
              </div>
            </header>

            <p
              className={cn(
                "mb-6 text-base italic text-muted-foreground",
                resolvedArticleTheme.typography.bodyFontClassName,
              )}
              style={resolvedArticleTheme.readingLayout.bodyTextStyle}
            >
              {AI_DISCLOSURE_TEXT}
            </p>

            {summary ? (
              <aside
                aria-label="Article summary"
                className={cn(
                  "article-summary mb-8",
                  resolvedArticleTheme.readingLayout.summaryClassName,
                )}
                style={resolvedArticleTheme.readingLayout.summaryStyle}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  TL;DR
                </div>
                <p
                  className={cn(
                    "mt-2 text-base text-foreground",
                    resolvedArticleTheme.typography.bodyFontClassName,
                  )}
                  style={resolvedArticleTheme.readingLayout.bodyTextStyle}
                >
                  {summary}
                </p>
              </aside>
            ) : article.excerpt ? (
              <p
                className={cn(
                  "article-excerpt mb-8 text-base text-muted-foreground",
                  resolvedArticleTheme.typography.bodyFontClassName,
                )}
                style={resolvedArticleTheme.readingLayout.bodyTextStyle}
              >
                {article.excerpt}
              </p>
            ) : null}

            {featuredImageUrl ? (
              <div
                className={cn(
                  "relative mb-8 aspect-[16/9] overflow-hidden",
                  resolvedArticleTheme.readingLayout.heroClassName,
                )}
                style={resolvedArticleTheme.readingLayout.heroStyle}
              >
                <Image
                  src={featuredImageUrl}
                  alt={featuredImageAlt}
                  fill
                  sizes="(min-width: 1024px) 768px, 100vw"
                  priority
                  className="object-cover"
                />
              </div>
            ) : null}

            <ArticleBodyRenderer
              articleId={article.id}
              htmlBody={articleBodyWithoutDisclosure}
              articleTheme={resolvedArticleTheme}
            />

            {articleTags.length > 0 ? (
              <div className="mt-10 border-t border-border pt-6">
                <div className="flex flex-wrap gap-2">
                  {articleTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <FeedbackWidget articleId={article.id} />
          </article>

          <aside className="space-y-6 lg:sticky lg:top-28">
            <TableOfContents
              headings={articleHeadings}
              theme={resolvedArticleTheme.tableOfContents}
            />
            <div
              className={cn(
                "p-7",
                resolvedArticleTheme.readingLayout.sidebarCardClassName,
              )}
              style={resolvedArticleTheme.readingLayout.sidebarCardStyle}
            >
              <h2
                className={cn(
                  "font-semibold leading-tight text-foreground",
                  resolvedArticleTheme.typography.headingFontClassName,
                  resolvedArticleTheme.typography.sectionTitleClassName,
                )}
              >
                Powered by Supportsheep
              </h2>
              <p
                className={cn(
                  "mt-4 text-base text-muted-foreground",
                  resolvedArticleTheme.typography.bodyFontClassName,
                )}
                style={resolvedArticleTheme.readingLayout.bodyTextStyle}
              >
                Supportsheep is the open-source platform that publishes this support portal.
                Spin up your own in minutes.
              </p>
              <Link
                href="https://supportsheep.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                Powered by Supportsheep
              </Link>
            </div>
          </aside>
        </div>

        {relatedArticles.length > 0 ? (
          <section className="mt-14 border-t border-border pt-10">
            <h2
              className={cn(
                "mb-6 font-semibold text-foreground",
                resolvedArticleTheme.typography.headingFontClassName,
                resolvedArticleTheme.typography.sectionTitleClassName,
              )}
            >
              Related Articles
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {relatedArticles.map((relatedArticle) => (
                <ArticleCard
                  key={relatedArticle.id}
                  article={relatedArticle}
                  articleTheme={resolvedArticleTheme}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
