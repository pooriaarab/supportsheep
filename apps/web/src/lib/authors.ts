/**
 * Helpers for the named-author system. Centralizes path generation and Person
 * JSON-LD construction so the byline, article structured data, and author
 * archive page stay consistent.
 */

import type { Author } from "@repo/types";

/**
 * Build the canonical public path for an author archive page.
 */
export function getAuthorPath(authorId: string): string {
  return `/authors/${authorId}`;
}

/**
 * Build a schema.org `Person` payload for embedding inside `BlogPosting.author`
 * or as a standalone `<script type="application/ld+json">` on the author page.
 */
export function buildAuthorPersonSchema(author: Author, siteUrl: string) {
  const url = `${siteUrl}${getAuthorPath(author.id)}`;
  const payload: Record<string, unknown> = {
    "@type": "Person",
    name: author.name,
    url,
  };

  if (author.jobTitle) payload.jobTitle = author.jobTitle;
  if (author.bio) payload.description = author.bio;
  if (author.avatarUrl) payload.image = author.avatarUrl;
  if (author.email) payload.email = author.email;
  if (author.sameAs && author.sameAs.length > 0) {
    payload.sameAs = author.sameAs;
  }

  return payload;
}

/**
 * Build the full `Person` JSON-LD document rendered on the `/authors/{slug}`
 * archive page (adds `@context` to the inner schema).
 */
export function buildAuthorJsonLd(author: Author, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    ...buildAuthorPersonSchema(author, siteUrl),
  };
}
