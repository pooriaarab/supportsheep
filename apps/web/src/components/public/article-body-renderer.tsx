/**
 * Shared renderer for the article body. Used by:
 * - The published-post page (`apps/web/src/app/[slug]/page.tsx` →
 *   `<ArticlePage>`), where the body is the article's stored HTML.
 * - The live interview canvas
 *   (`apps/web/src/components/interview/canvas-collaborative-editor.tsx`),
 *   where the body is converted from the streaming TipTap JSON snapshot.
 *
 * Centralising the markup here guarantees pixel parity between the in-call
 * canvas and the published article: both go through the same sanitize +
 * heading-id transform pipeline and emit the same prose/typography
 * container so the reader sees the same visual once it lands on the blog.
 *
 * The component intentionally accepts pre-rendered HTML rather than a
 * TipTap JSON doc so that it remains usable from React Server Components
 * (TipTap's `generateHTML` needs a DOM and only runs on the client).
 * Callers that have a TipTap JSON doc should convert it client-side first
 * via `tiptapDocToHtml` from `@/lib/interviews/tiptap-doc-to-html` before
 * passing it in.
 */
import type { CSSProperties } from "react";
import { renderArticleBodySafely } from "@/components/public/article-body";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import type { ArticleHeading } from "@/lib/article-body";

export interface ArticleBodyRendererProps {
  /** Stable id used for diagnostic logging when sanitize/transform fails. */
  articleId: string;
  /** Raw HTML body (already TipTap-serialised; safe to be untrusted). */
  htmlBody: string;
  /** Optional theme; defaults to the standard public article theme. */
  articleTheme?: ResolvedPublicArticleTheme;
  /** Optional extra class applied to the prose container. */
  className?: string;
  /** Optional inline style applied to the prose container. */
  style?: CSSProperties;
  /**
   * Callback invoked with the heading list extracted by
   * {@link renderArticleBodySafely}. Lets the published page render a ToC
   * sibling without duplicating the parse step.
   */
  onHeadingsExtracted?: (headings: ArticleHeading[]) => void;
}

/**
 * Renders the sanitized + heading-anchored article body using the standard
 * prose/typography styles applied to published posts.
 */
export function ArticleBodyRenderer({
  articleId,
  htmlBody,
  articleTheme,
  className,
  style,
  onHeadingsExtracted,
}: ArticleBodyRendererProps) {
  const theme = articleTheme ?? resolvePublicArticleTheme(undefined);
  const { html, headings } = renderArticleBodySafely(articleId, htmlBody);
  if (onHeadingsExtracted) onHeadingsExtracted(headings);

  const proseClass = className
    ? `${theme.typography.proseClassName} ${className}`
    : theme.typography.proseClassName;

  return (
    <div
      className={proseClass}
      style={{ ...theme.readingLayout.bodyTextStyle, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
