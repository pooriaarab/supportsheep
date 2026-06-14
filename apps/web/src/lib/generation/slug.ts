/**
 * Slug Generator
 *
 * Converts a title string into a URL-safe slug.
 */

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
