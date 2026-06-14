import { getArticleBySlug as repoGetArticleBySlug } from "@/lib/articles/repository";

export function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Look up an article by slug in D1, scoped to the caller's blog.
 * Returns the full Article (with id) or null if not found.
 */
export async function getArticleBySlug(blogId: string, slug: string) {
  const article = await repoGetArticleBySlug(blogId, slug);
  return article ?? null;
}
