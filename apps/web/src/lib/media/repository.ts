import "server-only";

import { and, desc, eq, like, not, or, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { media } from "@/db/schema/media";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:media");

type DB = DrizzleD1Database<typeof schema>;

// ---------------------------------------------------------------------------
// Row → public shape
// ---------------------------------------------------------------------------

type Row = typeof media.$inferSelect;

export interface MediaEntry {
  id: string;
  blogId: string;
  filename: string;
  url: string;
  storagePath: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  uploadedBy: string;
  createdAt: number;
  updatedAt: number;
}

function toEntry(row: Row): MediaEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    filename: row.filename,
    url: row.url,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Type → mime_type filter
// ---------------------------------------------------------------------------

export type MediaType = "image" | "video" | "document" | "other";

/**
 * Build a mime_type predicate for a high-level media type. `image`/`video` map
 * to a single mime prefix; `document` covers application/* and text/*; `other`
 * is the negation of the three known families.
 */
function mimeTypeFilter(type: MediaType): SQL | undefined {
  switch (type) {
    case "image":
      return like(media.mimeType, "image/%");
    case "video":
      return like(media.mimeType, "video/%");
    case "document":
      return or(
        like(media.mimeType, "application/%"),
        like(media.mimeType, "text/%"),
      );
    case "other":
      return and(
        not(like(media.mimeType, "image/%")),
        not(like(media.mimeType, "video/%")),
        not(like(media.mimeType, "application/%")),
        not(like(media.mimeType, "text/%")),
      );
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listMedia(
  blogId: string,
  {
    limit = 50,
    offset = 0,
    type,
  }: { limit?: number; offset?: number; type?: MediaType } = {},
  db: DB = getDb(),
): Promise<MediaEntry[]> {
  const filter = type ? mimeTypeFilter(type) : undefined;
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.blogId, blogId), filter))
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(limit)
    .offset(offset);
  return rows.map(toEntry);
}

export async function getMedia(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<MediaEntry | null> {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.blogId, blogId), eq(media.id, id)));
  return row ? toEntry(row) : null;
}

export type CreateMediaInput = {
  id?: string;
  filename: string;
  url: string;
  storagePath?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  uploadedBy?: string;
};

export async function createMedia(
  blogId: string,
  input: CreateMediaInput,
  db: DB = getDb(),
): Promise<MediaEntry> {
  const id = input.id ?? nanoid();
  const now = Date.now();

  await db.insert(media).values({
    id,
    blogId,
    filename: input.filename,
    url: input.url,
    storagePath: input.storagePath ?? "",
    mimeType: input.mimeType,
    size: input.size,
    width: input.width ?? 0,
    height: input.height ?? 0,
    alt: input.alt ?? "",
    uploadedBy: input.uploadedBy ?? "",
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created media entry", { id, blogId });

  return {
    id,
    blogId,
    filename: input.filename,
    url: input.url,
    storagePath: input.storagePath ?? "",
    mimeType: input.mimeType,
    size: input.size,
    width: input.width ?? 0,
    height: input.height ?? 0,
    alt: input.alt ?? "",
    uploadedBy: input.uploadedBy ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

export type UpdateMediaInput = {
  alt?: string;
};

export async function updateMedia(
  blogId: string,
  id: string,
  patch: UpdateMediaInput,
  db: DB = getDb(),
): Promise<MediaEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.alt !== undefined) updates.alt = patch.alt;

  const [row] = await db
    .update(media)
    .set({ ...updates, updatedAt: Date.now() })
    .where(and(eq(media.blogId, blogId), eq(media.id, id)))
    .returning();

  return row ? toEntry(row) : null;
}

export async function deleteMedia(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<MediaEntry | null> {
  const [row] = await db
    .delete(media)
    .where(and(eq(media.blogId, blogId), eq(media.id, id)))
    .returning();
  return row ? toEntry(row) : null;
}
