import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { sitemapEntries } from "@/db/schema/seo";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:seo:sitemaps");

type DB = DrizzleD1Database<typeof schema>;

/** Entry shape returned to API callers. */
export interface SitemapEntry {
  id: string;
  blogId: string;
  url: string;
  urls: string[];
  lastFetched: number | null;
  createdAt: number;
  updatedAt: number;
}

type Row = typeof sitemapEntries.$inferSelect;

function toEntry(row: Row): SitemapEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    url: row.url,
    urls: row.urls ? (JSON.parse(row.urls) as string[]) : [],
    lastFetched: row.lastFetched ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listSitemaps(
  blogId: string,
  db: DB = getDb(),
): Promise<SitemapEntry[]> {
  const rows = await db
    .select()
    .from(sitemapEntries)
    .where(eq(sitemapEntries.blogId, blogId))
    // last_fetched desc + id tiebreaker for deterministic ordering
    .orderBy(desc(sitemapEntries.lastFetched), desc(sitemapEntries.id));
  return rows.map(toEntry);
}

/** Pipeline helper — returns up to `limit` sitemaps for the blog. */
export async function listSitemapsForBlog(
  blogId: string,
  limit = 5,
  db: DB = getDb(),
): Promise<SitemapEntry[]> {
  const rows = await db
    .select()
    .from(sitemapEntries)
    .where(eq(sitemapEntries.blogId, blogId))
    .orderBy(desc(sitemapEntries.lastFetched), desc(sitemapEntries.id))
    .limit(limit);
  return rows.map(toEntry);
}

export async function getSitemap(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<SitemapEntry | null> {
  const rows = await db
    .select()
    .from(sitemapEntries)
    .where(and(eq(sitemapEntries.blogId, blogId), eq(sitemapEntries.id, id)))
    .limit(1);
  return rows[0] ? toEntry(rows[0]) : null;
}

export type CreateSitemapInput = {
  url: string;
  urls: string[];
  lastFetched: number;
};

export async function createSitemap(
  blogId: string,
  input: CreateSitemapInput,
  db: DB = getDb(),
): Promise<{ id: string }> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(sitemapEntries).values({
    id,
    blogId,
    url: input.url,
    urls: JSON.stringify(input.urls),
    lastFetched: input.lastFetched,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created sitemap entry", { id, blogId, url: input.url });

  return { id };
}

export type UpdateSitemapInput = {
  urls: string[];
  lastFetched: number;
};

/**
 * Returns the updated entry, or null if not found for this blog (tenant-scoped).
 */
export async function updateSitemap(
  blogId: string,
  id: string,
  patch: UpdateSitemapInput,
  db: DB = getDb(),
): Promise<SitemapEntry | null> {
  const [row] = await db
    .update(sitemapEntries)
    .set({
      urls: JSON.stringify(patch.urls),
      lastFetched: patch.lastFetched,
      updatedAt: Date.now(),
    })
    .where(and(eq(sitemapEntries.blogId, blogId), eq(sitemapEntries.id, id)))
    .returning();

  return row ? toEntry(row) : null;
}

/**
 * Returns true if deleted, false if not found (tenant-scoped).
 */
export async function deleteSitemap(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(sitemapEntries)
    .where(and(eq(sitemapEntries.blogId, blogId), eq(sitemapEntries.id, id)))
    .returning({ id: sitemapEntries.id });
  return rows.length > 0;
}
