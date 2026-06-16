import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { templates } from "@/db/schema/templates";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:templates");

type DB = DrizzleD1Database<typeof schema>;

/** Entry shape returned by listTemplates and updateTemplate (GET/PUT response). */
export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: number;
  usageCount: number;
  createdAt: number | null;
}

/** Shape returned by createTemplate (POST 201 response — no createdAt). */
export interface CreateTemplateResult {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: number;
  usageCount: 0;
}

type Row = typeof templates.$inferSelect;

function toEntry(row: Row): TemplateEntry {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    fields: row.fields,
    usageCount: row.usageCount,
    createdAt: row.createdAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listTemplates(
  blogId: string,
  db: DB = getDb(),
): Promise<TemplateEntry[]> {
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.blogId, blogId))
    // id tiebreaker keeps ordering deterministic for same-millisecond inserts
    // (created_at is ms-resolution).
    .orderBy(desc(templates.createdAt), desc(templates.id));
  return rows.map(toEntry);
}

export type CreateTemplateInput = {
  name: string;
  description?: string;
  category?: string;
  fields?: number;
};

export async function createTemplate(
  blogId: string,
  input: CreateTemplateInput,
  db: DB = getDb(),
): Promise<CreateTemplateResult> {
  const id = nanoid();
  const now = Date.now();

  const name = input.name;
  const description = input.description ?? "";
  const category = input.category ?? "General";
  const fields = input.fields ?? 0;

  await db.insert(templates).values({
    id,
    blogId,
    name,
    description,
    category,
    fields,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created template", { id, blogId });

  return {
    id,
    name,
    description,
    category,
    fields,
    usageCount: 0,
  };
}

export type UpdateTemplateInput = {
  name?: string;
  description?: string;
  category?: string;
  fields?: number;
};

/**
 * Returns the updated TemplateEntry, or null if no template with that id
 * exists for the knowledge base (404 semantics).
 */
export async function updateTemplate(
  blogId: string,
  id: string,
  patch: UpdateTemplateInput,
  db: DB = getDb(),
): Promise<TemplateEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.fields !== undefined) updates.fields = patch.fields;

  const [row] = await db
    .update(templates)
    .set({ ...updates, updatedAt: Date.now() })
    .where(and(eq(templates.blogId, blogId), eq(templates.id, id)))
    .returning();

  return row ? toEntry(row) : null;
}

/**
 * Returns true if the row was deleted, false if not found.
 */
export async function deleteTemplate(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(templates)
    .where(and(eq(templates.blogId, blogId), eq(templates.id, id)))
    .returning({ id: templates.id });
  return rows.length > 0;
}
