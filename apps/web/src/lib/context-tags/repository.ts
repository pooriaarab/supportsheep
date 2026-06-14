import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { contextTags } from "@/db/schema/context-tags";

type DB = DrizzleD1Database<typeof schema>;

type Row = typeof contextTags.$inferSelect;

/** API entry shape (matches the ContextTag type from @repo/types). */
export interface ContextTagEntry {
  id: string;
  blogId: string;
  name: string;
  targetAudience: string;
  tone: string;
  style: string;
  language: string;
  customPrompt: string;
  articleLength: { min: number; max: number };
  cta: { text: string; url: string };
  imageSettings: {
    style: string;
    colorScheme: string;
    count: number;
    aspectRatio: string;
  };
  createdAt: string;
}

const DEFAULT_ARTICLE_LENGTH = { min: 1000, max: 2000 };
const DEFAULT_CTA = { text: "", url: "" };
const DEFAULT_IMAGE_SETTINGS = {
  style: "realistic",
  colorScheme: "",
  count: 3,
  aspectRatio: "16:9",
};

function toEntry(row: Row): ContextTagEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    name: row.name,
    targetAudience: row.targetAudience ?? "",
    tone: row.tone ?? "professional",
    style: row.style ?? "informative",
    language: row.language ?? "English",
    customPrompt: row.customPrompt ?? "",
    articleLength: row.articleLength
      ? (JSON.parse(row.articleLength) as { min: number; max: number })
      : DEFAULT_ARTICLE_LENGTH,
    cta: row.cta
      ? (JSON.parse(row.cta) as { text: string; url: string })
      : DEFAULT_CTA,
    imageSettings: row.imageSettings
      ? (JSON.parse(row.imageSettings) as {
          style: string;
          colorScheme: string;
          count: number;
          aspectRatio: string;
        })
      : DEFAULT_IMAGE_SETTINGS,
    createdAt: row.createdAt,
  };
}

export async function listContextTags(
  blogId: string,
  db: DB = getDb(),
): Promise<ContextTagEntry[]> {
  const rows = await db
    .select()
    .from(contextTags)
    .where(eq(contextTags.blogId, blogId))
    .orderBy(asc(contextTags.name));
  return rows.map(toEntry);
}

export type CreateContextTagInput = {
  name: string;
  targetAudience?: string;
  tone?: string;
  style?: string;
  language?: string;
  customPrompt?: string;
  articleLength?: { min: number; max: number };
  cta?: { text: string; url: string };
  imageSettings?: {
    style: string;
    colorScheme: string;
    count: number;
    aspectRatio: string;
  };
};

export async function createContextTag(
  blogId: string,
  input: CreateContextTagInput,
  db: DB = getDb(),
): Promise<{ id: string }> {
  const id = nanoid();
  await db.insert(contextTags).values({
    id,
    blogId,
    name: input.name,
    targetAudience: input.targetAudience ?? "",
    tone: input.tone ?? "professional",
    style: input.style ?? "informative",
    language: input.language ?? "English",
    customPrompt: input.customPrompt ?? "",
    articleLength: JSON.stringify(input.articleLength ?? DEFAULT_ARTICLE_LENGTH),
    cta: JSON.stringify(input.cta ?? DEFAULT_CTA),
    imageSettings: JSON.stringify(input.imageSettings ?? DEFAULT_IMAGE_SETTINGS),
  });
  return { id };
}

export async function getContextTag(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<ContextTagEntry | null> {
  const rows = await db
    .select()
    .from(contextTags)
    .where(and(eq(contextTags.blogId, blogId), eq(contextTags.id, id)))
    .limit(1);
  return rows[0] ? toEntry(rows[0]) : null;
}

export type UpdateContextTagInput = {
  name?: string;
  targetAudience?: string;
  tone?: string;
  style?: string;
  language?: string;
  customPrompt?: string;
  articleLength?: { min: number; max: number };
  cta?: { text: string; url: string };
  imageSettings?: {
    style: string;
    colorScheme: string;
    count: number;
    aspectRatio: string;
  };
};

/**
 * Updates only the provided fields on a context tag scoped to the blog.
 * Returns the updated entry, or null if no tag with that id/blogId exists.
 */
export async function updateContextTag(
  blogId: string,
  id: string,
  patch: UpdateContextTagInput,
  db: DB = getDb(),
): Promise<ContextTagEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.targetAudience !== undefined) updates.targetAudience = patch.targetAudience;
  if (patch.tone !== undefined) updates.tone = patch.tone;
  if (patch.style !== undefined) updates.style = patch.style;
  if (patch.language !== undefined) updates.language = patch.language;
  if (patch.customPrompt !== undefined) updates.customPrompt = patch.customPrompt;
  if (patch.articleLength !== undefined) {
    updates.articleLength = JSON.stringify(patch.articleLength);
  }
  if (patch.cta !== undefined) {
    updates.cta = JSON.stringify(patch.cta);
  }
  if (patch.imageSettings !== undefined) {
    updates.imageSettings = JSON.stringify(patch.imageSettings);
  }

  const [row] = await db
    .update(contextTags)
    .set(updates)
    .where(and(eq(contextTags.blogId, blogId), eq(contextTags.id, id)))
    .returning();
  return row ? toEntry(row) : null;
}

export async function deleteContextTag(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(contextTags)
    .where(and(eq(contextTags.blogId, blogId), eq(contextTags.id, id)))
    .returning({ id: contextTags.id });
  return rows.length > 0;
}
