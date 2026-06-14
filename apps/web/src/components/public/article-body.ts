/**
 * Render-path helpers for the public article body. Lives in a standalone
 * module so both the published-post server component (`article-page.tsx`)
 * and the interview canvas client component (`canvas-collaborative-editor.tsx`)
 * can share the same sanitize + heading-id transform pipeline without
 * pulling in the rest of the article page's server-side rendering.
 *
 * The sanitize step is defence-in-depth: the API write path already
 * sanitises stored bodies via `sanitizeArticleHtml`. If anything throws
 * here (malformed input, parser edge case) we fall back to the safest
 * available render so a single broken article never 500s the public route.
 */
import { transformArticleBody } from "@/lib/article-body";
import type { ArticleHeading } from "@/lib/article-body";
import { createLogger } from "@/lib/logger";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

const articleRenderLogger = createLogger("public.article-body");

/**
 * Escapes HTML special characters so the string renders as visible
 * plaintext via `dangerouslySetInnerHTML` without executing tags or event
 * handlers. Used as the last-resort fallback when sanitization fails.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize + transform an article HTML body, with a defensive fallback so
 * a single broken article never 500s the public route. Returns the
 * post-transform HTML plus the heading list (used by the published page
 * to render its sticky table of contents).
 */
export function renderArticleBodySafely(
  articleId: string,
  body: string,
): { html: string; headings: ArticleHeading[] } {
  if (!body) return { html: "", headings: [] };
  let sanitized: string;
  let sanitizerFailed = false;
  try {
    sanitized = sanitizeArticleHtml(body);
  } catch (error) {
    articleRenderLogger.error(
      "sanitizeArticleHtml failed; falling back to escaped body",
      {
        articleId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    sanitized = body;
    sanitizerFailed = true;
  }
  try {
    if (sanitizerFailed) {
      return { html: escapeHtml(sanitized), headings: [] };
    }
    return transformArticleBody(sanitized);
  } catch (error) {
    articleRenderLogger.error(
      "transformArticleBody failed; rendering without headings",
      {
        articleId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return { html: sanitized, headings: [] };
  }
}
