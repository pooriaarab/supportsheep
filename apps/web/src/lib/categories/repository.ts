import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { categories } from "@/db/schema/categories";

type DB = DrizzleD1Database<typeof schema>;

/** API entry shape (matches the previous Firestore `CategoryConfig.order` value). */
export interface CategoryEntry {
  slug: string;
  displayName: string;
  order: number;
  icon: string;
  description: string;
  postCount: number;
}

type Row = typeof categories.$inferSelect;

function toEntry(row: Row): CategoryEntry {
  return {
    slug: row.slug,
    displayName: row.displayName,
    order: row.sortOrder,
    icon: row.icon ?? "",
    description: row.description ?? "",
    postCount: row.postCount,
  };
}

export async function listCategories(blogId: string, db: DB = getDb()): Promise<CategoryEntry[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.sortOrder));
  return rows.map(toEntry);
}

export type CreateCategoryInput = {
  slug: string;
  displayName: string;
  icon?: string;
  description?: string;
};

export async function createCategory(
  blogId: string,
  input: CreateCategoryInput,
  db: DB = getDb(),
): Promise<{ ok: true; entry: CategoryEntry } | { ok: false; reason: "duplicate" }> {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.blogId, blogId), eq(categories.slug, input.slug)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: "duplicate" };
  }

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${categories.sortOrder}), -1)` })
    .from(categories)
    .where(eq(categories.blogId, blogId));
  const nextOrder = (maxRow[0]?.max ?? -1) + 1;

  try {
    const [row] = await db
      .insert(categories)
      .values({
        id: nanoid(),
        blogId,
        slug: input.slug,
        displayName: input.displayName,
        icon: input.icon ?? "",
        description: input.description ?? "",
        sortOrder: nextOrder,
        postCount: 0,
      })
      .returning();
    return { ok: true, entry: toEntry(row) };
  } catch (err) {
    // A concurrent insert can race past the pre-check above; the UNIQUE(blog_id,
    // slug) index is the real guard — treat its violation as a duplicate.
    if (String((err as Error)?.message ?? err).includes("UNIQUE constraint failed")) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export type UpdateCategoryInput = {
  displayName?: string;
  icon?: string;
  description?: string;
};

/** Caller must ensure `patch` has at least one field (the route returns 400 otherwise).
 * Returns the updated entry, or null if no category with that slug exists. */
export async function updateCategory(
  blogId: string,
  slug: string,
  patch: UpdateCategoryInput,
  db: DB = getDb(),
): Promise<CategoryEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.displayName !== undefined) updates.displayName = patch.displayName;
  if (patch.icon !== undefined) updates.icon = patch.icon;
  if (patch.description !== undefined) updates.description = patch.description;

  const [row] = await db
    .update(categories)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(and(eq(categories.blogId, blogId), eq(categories.slug, slug)))
    .returning();
  return row ? toEntry(row) : null;
}

export async function deleteCategory(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(categories)
    .where(and(eq(categories.blogId, blogId), eq(categories.slug, slug)))
    .returning({ id: categories.id });
  return rows.length > 0;
}

export async function reorderCategories(
  blogId: string,
  order: Record<string, number>,
  db: DB = getDb(),
): Promise<number> {
  const entries = Object.entries(order);
  if (entries.length === 0) return 0;
  // Atomic batch (single round-trip on D1) so a partial failure can't leave
  // categories half-reordered — matches the previous single-doc Firestore update.
  const stmts = entries.map(([slug, value]) =>
    db
      .update(categories)
      .set({ sortOrder: value, updatedAt: new Date().toISOString() })
      .where(and(eq(categories.blogId, blogId), eq(categories.slug, slug))),
  );
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  return entries.length;
}
