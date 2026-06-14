import "server-only";

import { and, desc, asc, eq, lt, gt, ne } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { articles } from "@/db/schema/articles";
import type { Article } from "@repo/types";

type DB = DrizzleD1Database<typeof schema>;

type Row = typeof articles.$inferSelect;

/** Parse a DB row back into a full Article object. `id` is guaranteed. */
function toArticle(row: Row): Article & { id: string } {
  const parsed = JSON.parse(row.data) as Article;
  return { ...parsed, id: row.id };
}

/** Build the denormalized column values from a full Article + id. */
function toCols(id: string, article: Article): typeof articles.$inferInsert {
  return {
    id,
    blogId: article.blogId,
    slug: article.slug,
    status: article.status,
    category: article.category || null,
    primaryCategory: article.primaryCategory || null,
    postType: article.postType || null,
    authorId: article.authorId || null,
    publishedAt: article.publishedAt || null,
    scheduledAt: article.scheduledAt || null,
    wordCount: article.wordCount ?? null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    data: JSON.stringify({ ...article, id }),
  };
}

/* -------------------------------------------------------------------------- */
/* List                                                                         */
/* -------------------------------------------------------------------------- */

export interface ListArticlesOpts {
  status?: string | null;
  category?: string | null;
  postType?: string | null;
  orderBy?: string | null;
  orderDir?: "asc" | "desc";
  limit: number;
  startAfter?: string | null;
  search?: string | null;
}

/** Map a public orderBy field name to the actual drizzle column. */
function getOrderCol(orderBy: string | null | undefined) {
  switch (orderBy) {
    case "createdAt":
      return articles.createdAt;
    case "publishedAt":
      return articles.publishedAt;
    case "wordCount":
      return articles.wordCount;
    case "slug":
      return articles.slug;
    case "status":
      return articles.status;
    case "updatedAt":
    default:
      return articles.updatedAt;
  }
}

export async function listArticles(
  blogId: string,
  opts: ListArticlesOpts,
  db: DB = getDb(),
): Promise<{ articles: (Article & { id: string })[]; hasMore: boolean }> {
  const {
    status,
    category,
    postType,
    orderBy,
    orderDir = "desc",
    limit,
    startAfter,
    search,
  } = opts;

  const orderCol = getOrderCol(orderBy);

  // Cursor: look up the cursor row's orderBy column value for keyset pagination
  let cursorExpr: ReturnType<typeof lt> | undefined;
  if (startAfter) {
    const cursorRows = await db
      .select({ val: orderCol })
      .from(articles)
      .where(and(eq(articles.blogId, blogId), eq(articles.id, startAfter)))
      .limit(1);

    if (cursorRows.length > 0) {
      const cursorVal = cursorRows[0].val as string;
      cursorExpr = orderDir === "desc" ? lt(orderCol, cursorVal) : gt(orderCol, cursorVal);
    }
  }

  const orderExpr =
    orderDir === "desc" ? desc(orderCol) : asc(orderCol);

  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.blogId, blogId),
        status ? eq(articles.status, status) : undefined,
        category ? eq(articles.category, category) : undefined,
        postType ? eq(articles.postType, postType) : undefined,
        cursorExpr,
      ),
    )
    .orderBy(orderExpr)
    .limit(limit);

  let results = rows.map(toArticle);

  // Client-side title search (matches existing Firestore behavior)
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (a) => typeof a.title === "string" && a.title.toLowerCase().includes(q),
    );
  }

  return {
    articles: results,
    hasMore: rows.length === limit,
  };
}

/* -------------------------------------------------------------------------- */
/* Get by slug                                                                  */
/* -------------------------------------------------------------------------- */

export async function getArticleBySlug(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<(Article & { id: string }) | null> {
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.blogId, blogId), eq(articles.slug, slug)))
    .limit(1);
  return rows[0] ? toArticle(rows[0]) : null;
}

/** Fetch an article by its document id (not slug), scoped to a blog. */
export async function getArticleById(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<(Article & { id: string }) | null> {
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.blogId, blogId), eq(articles.id, id)))
    .limit(1);
  return rows[0] ? toArticle(rows[0]) : null;
}

/* -------------------------------------------------------------------------- */
/* Slug uniqueness helper (used by buildArticleCreateDocument)                 */
/* -------------------------------------------------------------------------- */

export async function slugExists(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.blogId, blogId), eq(articles.slug, slug)))
    .limit(1);
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                       */
/* -------------------------------------------------------------------------- */

export async function createArticle(
  blogId: string,
  article: Article,
  db: DB = getDb(),
): Promise<{ ok: true; article: Article & { id: string } } | { ok: false; reason: "duplicate" }> {
  const existing = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.blogId, blogId), eq(articles.slug, article.slug)))
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, reason: "duplicate" };
  }

  const id = nanoid();
  const cols = toCols(id, { ...article, blogId });

  try {
    const [row] = await db.insert(articles).values(cols).returning();
    return { ok: true, article: toArticle(row) };
  } catch (err) {
    if (String((err as Error)?.message ?? err).includes("UNIQUE constraint failed")) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Update by slug                                                               */
/* -------------------------------------------------------------------------- */

export async function updateArticleBySlug(
  blogId: string,
  slug: string,
  patch: Partial<Article>,
  db: DB = getDb(),
): Promise<(Article & { id: string }) | null> {
  const existing = await getArticleBySlug(blogId, slug, db);
  if (!existing) return null;

  const merged: Article = { ...existing, ...patch };
  merged.updatedAt = new Date().toISOString();

  const cols = toCols(existing.id, merged);

  const [row] = await db
    .update(articles)
    .set(cols)
    .where(and(eq(articles.blogId, blogId), eq(articles.slug, slug)))
    .returning();

  return row ? toArticle(row) : null;
}

/* -------------------------------------------------------------------------- */
/* Delete by slug                                                               */
/* -------------------------------------------------------------------------- */

export async function deleteArticleBySlug(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(articles)
    .where(and(eq(articles.blogId, blogId), eq(articles.slug, slug)))
    .returning({ id: articles.id });
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Submit for review                                                            */
/* -------------------------------------------------------------------------- */

export async function submitArticleForReview(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<
  | { ok: true; article: Article & { id: string } }
  | { ok: false; reason: "not_found" | "wrong_status" }
> {
  const existing = await getArticleBySlug(blogId, slug, db);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status !== "draft") return { ok: false, reason: "wrong_status" };

  const updated = await updateArticleBySlug(
    blogId,
    slug,
    { status: "pending_review" },
    db,
  );
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, article: updated };
}

/* -------------------------------------------------------------------------- */
/* Bulk delete by slugs                                                         */
/* -------------------------------------------------------------------------- */

export async function bulkDeleteArticles(
  blogId: string,
  slugs: string[],
  db: DB = getDb(),
): Promise<number> {
  if (slugs.length === 0) return 0;

  let count = 0;
  for (const slug of slugs) {
    const deleted = await deleteArticleBySlug(blogId, slug, db);
    if (deleted) count++;
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/* Public read queries (published-only, tenant-scoped)                         */
/* -------------------------------------------------------------------------- */

export interface ListPublishedArticlesOpts {
  /** Filter by primaryCategory slug. */
  category?: string | null;
  /** Filter to articles whose `tags` array contains this exact tag. */
  tag?: string | null;
  limit: number;
  /** Zero-based row offset for pagination (matches Firestore .offset() semantics). */
  offset?: number;
}

/** Safety cap for the in-memory tag scan (tags aren't a denormalized column;
 * a tags index/junction table is a future optimization). Bootstrap-blog scale. */
const TAG_SCAN_CAP = 1000;

/**
 * List published articles ordered by `published_at` desc, with optional
 * category and tag filters. Returns `hasMore` for pagination.
 * Matches the semantics of the old Firestore `getPublishedPublicArticles` /
 * `getPublishedArticles` queries (the old tag filter used `array-contains`).
 */
export async function listPublishedArticles(
  blogId: string,
  opts: ListPublishedArticlesOpts,
  db: DB = getDb(),
): Promise<{ articles: (Article & { id: string })[]; hasMore: boolean }> {
  const { category, tag, limit, offset = 0 } = opts;

  if (tag) {
    // `tags` lives in the JSON `data` blob (no denormalized column / SQL
    // array-contains), so filter in-memory over the published set, then
    // paginate. Bounded by TAG_SCAN_CAP for the current single-blog scale.
    const rows = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.blogId, blogId),
          eq(articles.status, "published"),
          category ? eq(articles.primaryCategory, category) : undefined,
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(TAG_SCAN_CAP);

    const matched = rows
      .map(toArticle)
      .filter((a) => Array.isArray(a.tags) && a.tags.includes(tag));
    const pagePlusOne = matched.slice(offset, offset + limit + 1);
    const hasMore = pagePlusOne.length > limit;
    return {
      articles: hasMore ? pagePlusOne.slice(0, limit) : pagePlusOne,
      hasMore,
    };
  }

  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.blogId, blogId),
        eq(articles.status, "published"),
        category ? eq(articles.primaryCategory, category) : undefined,
      ),
    )
    .orderBy(desc(articles.publishedAt))
    // Fetch limit+1 to detect whether more pages exist.
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  return {
    articles: (hasMore ? rows.slice(0, limit) : rows).map(toArticle),
    hasMore,
  };
}

/**
 * Fetch a single published article by slug.  Returns `null` for drafts or
 * non-existent slugs, matching the old Firestore
 * `getPublicArticleBySlug`/`getPublishedPublicArticleBySlug` behaviour.
 */
export async function getPublishedArticleBySlug(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<(Article & { id: string }) | null> {
  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.blogId, blogId),
        eq(articles.slug, slug),
        eq(articles.status, "published"),
      ),
    )
    .limit(1);
  return rows[0] ? toArticle(rows[0]) : null;
}

export interface GetRelatedArticlesOpts {
  /** Slug of the current article to exclude. */
  excludeSlug: string;
  /** Primary category slug to match related articles. */
  category?: string | null;
  /** Legacy `category` display-name value to fall back to. */
  legacyCategory?: string | null;
  /** Full category-slug list of the current article. Used as a secondary
   * "shared category" source (parity with the old array-contains-any query),
   * matched in-memory since `categories` lives in the JSON blob. */
  categories?: string[];
  /** Maximum number of results to return (applied after dedup). */
  limit: number;
}

/**
 * Fetch related published articles.  Queries by `primaryCategory` first, then
 * falls back to the legacy `category` column (matching the old Firestore
 * `getRelatedPublicArticles` two-query approach).  Deduplicates and excludes
 * the current article's slug.
 */
export async function getRelatedArticles(
  blogId: string,
  opts: GetRelatedArticlesOpts,
  db: DB = getDb(),
): Promise<(Article & { id: string })[]> {
  const { excludeSlug, category, legacyCategory, categories, limit } = opts;
  if (!category && !legacyCategory && !(categories && categories.length)) {
    return [];
  }

  const limitEach = limit * 4; // fetch generously; we'll deduplicate and trim

  // Primary query: match on primaryCategory
  const primaryRows = category
    ? await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.blogId, blogId),
            eq(articles.status, "published"),
            eq(articles.primaryCategory, category),
            ne(articles.slug, excludeSlug),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(limitEach)
    : [];

  // Legacy fallback query: match on category column (displayName value)
  const legacyRows =
    legacyCategory
      ? await db
          .select()
          .from(articles)
          .where(
            and(
              eq(articles.blogId, blogId),
              eq(articles.status, "published"),
              eq(articles.category, legacyCategory),
              ne(articles.slug, excludeSlug),
            ),
          )
          .orderBy(desc(articles.publishedAt))
          .limit(limitEach)
      : [];

  // Deduplicate by id, primary first
  const seen = new Set<string>();
  const results: (Article & { id: string })[] = [];

  for (const row of [...primaryRows, ...legacyRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    results.push(toArticle(row));
    if (results.length >= limit) break;
  }

  // Secondary "shared category" source: fill remaining slots with published
  // articles that overlap any of the current article's categories[]. `categories`
  // lives in the JSON blob, so this is matched in-memory over a capped scan
  // (parity with the old Firestore array-contains-any query).
  if (results.length < limit && categories && categories.length > 0) {
    const scanRows = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.blogId, blogId),
          eq(articles.status, "published"),
          ne(articles.slug, excludeSlug),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(TAG_SCAN_CAP);

    for (const row of scanRows) {
      if (seen.has(row.id)) continue;
      const a = toArticle(row);
      if (Array.isArray(a.categories) && a.categories.some((c) => categories.includes(c))) {
        seen.add(row.id);
        results.push(a);
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}

/**
 * List published articles for a category archive page.  Mirrors the old
 * Firestore `getPublicCategoryArticles` semantics: two queries (primaryCategory
 * slug + legacy category displayName), merged, deduplicated, and sorted by
 * `publishedAt` desc.  Returns a page slice with `hasMore` and `totalCount`.
 */
export async function listPublishedArticlesByCategory(
  blogId: string,
  opts: {
    categorySlug: string;
    categoryDisplayName: string;
    page: number;
    perPage: number;
  },
  db: DB = getDb(),
): Promise<{
  articles: (Article & { id: string })[];
  hasMore: boolean;
  totalCount: number;
}> {
  const { categorySlug, categoryDisplayName, page, perPage } = opts;
  const offset = (page - 1) * perPage;

  // Two queries to cover both normalised (primaryCategory slug) and legacy
  // (category displayName) data.
  const [primaryRows, legacyRows] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.blogId, blogId),
          eq(articles.status, "published"),
          eq(articles.primaryCategory, categorySlug),
        ),
      )
      .orderBy(desc(articles.publishedAt)),
    db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.blogId, blogId),
          eq(articles.status, "published"),
          eq(articles.category, categoryDisplayName),
        ),
      )
      .orderBy(desc(articles.publishedAt)),
  ]);

  // Merge and deduplicate by id
  const merged = new Map<string, Article & { id: string }>();
  for (const row of [...primaryRows, ...legacyRows]) {
    if (!merged.has(row.id)) {
      merged.set(row.id, toArticle(row));
    }
  }

  // Sort merged set by publishedAt desc (rows from D1 are already sorted within
  // each query but need re-sorting after merge).
  function getPublishedAtMillis(a: Article): number {
    if (!a.publishedAt) return 0;
    const ms = Date.parse(a.publishedAt);
    return Number.isNaN(ms) ? 0 : ms;
  }

  const sorted = Array.from(merged.values()).toSorted(
    (a, b) => getPublishedAtMillis(b) - getPublishedAtMillis(a),
  );

  const totalCount = sorted.length;
  const pageSlice = sorted.slice(offset, offset + perPage);
  const hasMore = offset + perPage < totalCount;

  return { articles: pageSlice, hasMore, totalCount };
}

/* -------------------------------------------------------------------------- */
/* WordPress import helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Find an article by its WordPress post ID (stored in the JSON data blob).
 * Scans all articles for the blog in-memory since wordpressPostId is not a
 * denormalized column. Bounded to the single-blog scale of the importer.
 */
const WP_SCAN_CAP = 10_000;

export async function getArticleByWordPressPostId(
  blogId: string,
  wordpressPostId: string,
  db: DB = getDb(),
): Promise<(Article & { id: string }) | null> {
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.blogId, blogId))
    .limit(WP_SCAN_CAP);

  for (const row of rows) {
    const article = toArticle(row);
    if (article.wordpressPostId === wordpressPostId) return article;
  }
  return null;
}

/**
 * Upsert an article for WordPress import:
 * - create when no existing article matches
 * - merge-update when an existing article is found (update by ID)
 *
 * Returns the upserted article.
 */
export async function upsertArticleForImport(
  blogId: string,
  targetId: string | null,
  articleData: Article,
  db: DB = getDb(),
): Promise<Article & { id: string }> {
  if (targetId) {
    // Update existing article by ID
    const merged: Article = { ...articleData, blogId };
    merged.updatedAt = new Date().toISOString();
    const cols = toCols(targetId, merged);

    const [row] = await db
      .update(articles)
      .set(cols)
      .where(and(eq(articles.blogId, blogId), eq(articles.id, targetId)))
      .returning();

    if (!row) throw new Error(`Article ${targetId} not found for update`);
    return toArticle(row);
  }

  // Create new article (delegate to createArticle for duplicate handling)
  const result = await createArticle(blogId, articleData, db);
  if (result.ok) return result.article;

  // Duplicate slug on create: update the existing row instead
  const existing = await getArticleBySlug(blogId, articleData.slug, db);
  if (!existing) throw new Error(`Slug duplicate but no existing article found: ${articleData.slug}`);
  const merged: Article = { ...articleData, blogId };
  merged.updatedAt = new Date().toISOString();
  const cols = toCols(existing.id, merged);
  const [row] = await db
    .update(articles)
    .set(cols)
    .where(and(eq(articles.blogId, blogId), eq(articles.id, existing.id)))
    .returning();
  if (!row) throw new Error(`Failed to update article for slug ${articleData.slug}`);
  return toArticle(row);
}

/**
 * Fetch published articles authored by `authorId`, newest first.
 */
export async function listPublishedArticlesByAuthor(
  blogId: string,
  authorId: string,
  limit = 50,
  db: DB = getDb(),
): Promise<(Article & { id: string })[]> {
  const rows = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.blogId, blogId),
        eq(articles.status, "published"),
        eq(articles.authorId, authorId),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return rows.map(toArticle);
}
