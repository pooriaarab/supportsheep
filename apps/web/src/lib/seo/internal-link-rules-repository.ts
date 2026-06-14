import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { internalLinkRules } from "@/db/schema/seo";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:seo:internal-link-rules");

type DB = DrizzleD1Database<typeof schema>;

/** Entry shape returned to API callers. */
export interface InternalLinkRuleEntry {
  id: string;
  blogId: string;
  keyword: string;
  targetUrl: string;
  maxPerArticle: number | null;
  createdAt: number;
  updatedAt: number;
}

type Row = typeof internalLinkRules.$inferSelect;

function toEntry(row: Row): InternalLinkRuleEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    keyword: row.keyword,
    targetUrl: row.targetUrl,
    maxPerArticle: row.maxPerArticle ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listInternalLinkRules(
  blogId: string,
  db: DB = getDb(),
): Promise<InternalLinkRuleEntry[]> {
  const rows = await db
    .select()
    .from(internalLinkRules)
    .where(eq(internalLinkRules.blogId, blogId))
    // keyword asc, id tiebreaker for deterministic ordering
    .orderBy(asc(internalLinkRules.keyword), asc(internalLinkRules.id));
  return rows.map(toEntry);
}

/** Pipeline helper — returns up to `limit` rules for the blog. */
export async function getInternalLinkRulesForBlog(
  blogId: string,
  limit = 50,
  db: DB = getDb(),
): Promise<InternalLinkRuleEntry[]> {
  const rows = await db
    .select()
    .from(internalLinkRules)
    .where(eq(internalLinkRules.blogId, blogId))
    .orderBy(asc(internalLinkRules.keyword), asc(internalLinkRules.id))
    .limit(limit);
  return rows.map(toEntry);
}

export type CreateInternalLinkRuleInput = {
  keyword: string;
  targetUrl: string;
  maxPerArticle?: number;
};

export async function createInternalLinkRule(
  blogId: string,
  input: CreateInternalLinkRuleInput,
  db: DB = getDb(),
): Promise<{ id: string }> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(internalLinkRules).values({
    id,
    blogId,
    keyword: input.keyword,
    targetUrl: input.targetUrl,
    maxPerArticle: input.maxPerArticle ?? null,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created internal link rule", { id, blogId });

  return { id };
}

export type UpdateInternalLinkRuleInput = {
  keyword?: string;
  targetUrl?: string;
  maxPerArticle?: number;
};

/**
 * Returns the updated entry, or null if not found for this blog (tenant-scoped).
 */
export async function updateInternalLinkRule(
  blogId: string,
  id: string,
  patch: UpdateInternalLinkRuleInput,
  db: DB = getDb(),
): Promise<InternalLinkRuleEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.keyword !== undefined) updates.keyword = patch.keyword;
  if (patch.targetUrl !== undefined) updates.targetUrl = patch.targetUrl;
  if (patch.maxPerArticle !== undefined) updates.maxPerArticle = patch.maxPerArticle;

  const [row] = await db
    .update(internalLinkRules)
    .set({ ...updates, updatedAt: Date.now() })
    .where(and(eq(internalLinkRules.blogId, blogId), eq(internalLinkRules.id, id)))
    .returning();

  return row ? toEntry(row) : null;
}

/**
 * Returns true if deleted, false if not found (tenant-scoped).
 */
export async function deleteInternalLinkRule(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(internalLinkRules)
    .where(and(eq(internalLinkRules.blogId, blogId), eq(internalLinkRules.id, id)))
    .returning({ id: internalLinkRules.id });
  return rows.length > 0;
}
