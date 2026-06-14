/**
 * Indexability guard for programmatic landing pages.
 *
 * Protects the site from thin-content SEO penalties: any page with fewer
 * than `THIN_CONTENT_WORD_THRESHOLD` words of unique content -- or an
 * explicit `noindex` publish status -- is rendered with `robots: noindex,
 * follow`. Published pages with enough unique content are indexable.
 */

import type { ProgrammaticPage } from "@repo/types";

/**
 * Minimum word count of `uniqueContent` required for a page to be treated
 * as indexable. Pages below this threshold emit `robots: noindex`.
 */
export const THIN_CONTENT_WORD_THRESHOLD = 400;

/**
 * Subset of {@link ProgrammaticPage} used for indexability decisions.
 * Accepts a loose type so call sites can pass the full doc or a derived
 * view model without friction.
 */
export type IndexabilityInput = Pick<
  ProgrammaticPage,
  "publishStatus" | "wordCount"
> & {
  /**
   * Optional raw content body. Used as a fallback when `wordCount` has
   * not been precomputed (e.g., ad-hoc callers).
   */
  uniqueContent?: string;
};

/**
 * Count words in a block of Markdown/HTML. Strips tags, collapses
 * whitespace, and splits on word boundaries. This is a heuristic meant
 * for thin-content detection, not a linguistic word count.
 */
export function countWords(content: string): number {
  if (!content) return 0;
  const stripped = content
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`~>\[\]()!|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

/**
 * Decide whether a programmatic page should be indexed by search engines.
 *
 * Returns `false` (noindex, follow) when:
 *   - `publishStatus` is `"draft"` or `"noindex"`
 *   - word count is below {@link THIN_CONTENT_WORD_THRESHOLD}
 *
 * Returns `true` (index, follow) otherwise.
 */
export function shouldIndex(page: IndexabilityInput): boolean {
  if (page.publishStatus !== "published") {
    return false;
  }

  const words =
    typeof page.wordCount === "number" && page.wordCount > 0
      ? page.wordCount
      : countWords(page.uniqueContent ?? "");

  return words >= THIN_CONTENT_WORD_THRESHOLD;
}

/**
 * Convenience helper: build the `robots` field for Next.js Metadata based
 * on a programmatic page's indexability.
 */
export function robotsForPage(page: IndexabilityInput): {
  index: boolean;
  follow: boolean;
} {
  return {
    index: shouldIndex(page),
    follow: true,
  };
}
