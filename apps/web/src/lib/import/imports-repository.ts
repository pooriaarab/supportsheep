import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { wordpressImports } from "@/db/schema/imports";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:import:imports-repository");

type DB = DrizzleD1Database<typeof schema>;

// ---------------------------------------------------------------------------
// Row → public shape
// ---------------------------------------------------------------------------

type Row = typeof wordpressImports.$inferSelect;

export interface FailedPost {
  slug: string;
  error: string;
}

export interface ImportEntry {
  id: string;
  blogId: string;
  source: string;
  status: string;
  totalPosts: number;
  importedPosts: number;
  rehostedImages: number;
  failedPosts: FailedPost[];
  createdBy: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function toEntry(row: Row): ImportEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    source: row.source,
    status: row.status,
    totalPosts: row.totalPosts,
    importedPosts: row.importedPosts,
    rehostedImages: row.rehostedImages,
    failedPosts: JSON.parse(row.failedPosts) as FailedPost[],
    createdBy: row.createdBy ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export type CreateImportInput = {
  totalPosts: number;
  createdBy?: string;
};

export async function createImport(
  blogId: string,
  input: CreateImportInput,
  db: DB = getDb(),
): Promise<ImportEntry> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(wordpressImports).values({
    id,
    blogId,
    source: "wordpress",
    status: "running",
    totalPosts: input.totalPosts,
    importedPosts: 0,
    rehostedImages: 0,
    failedPosts: "[]",
    createdBy: input.createdBy ?? null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created import job", { id, blogId, totalPosts: input.totalPosts });

  return {
    id,
    blogId,
    source: "wordpress",
    status: "running",
    totalPosts: input.totalPosts,
    importedPosts: 0,
    rehostedImages: 0,
    failedPosts: [],
    createdBy: input.createdBy ?? null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getImport(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<ImportEntry | null> {
  const [row] = await db
    .select()
    .from(wordpressImports)
    .where(and(eq(wordpressImports.blogId, blogId), eq(wordpressImports.id, id)));
  return row ? toEntry(row) : null;
}

export async function listImports(
  blogId: string,
  { limit = 20 }: { limit?: number } = {},
  db: DB = getDb(),
): Promise<ImportEntry[]> {
  const rows = await db
    .select()
    .from(wordpressImports)
    .where(eq(wordpressImports.blogId, blogId))
    .orderBy(desc(wordpressImports.startedAt), desc(wordpressImports.id))
    .limit(limit);
  return rows.map(toEntry);
}

export type UpdateImportInput = {
  status?: string;
  importedPosts?: number;
  rehostedImages?: number;
  failedPosts?: FailedPost[];
  completedAt?: number | null;
};

export async function updateImport(
  blogId: string,
  id: string,
  patch: UpdateImportInput,
  db: DB = getDb(),
): Promise<ImportEntry | null> {
  const now = Date.now();

  const values: Partial<typeof wordpressImports.$inferInsert> = {
    updatedAt: now,
  };

  if (patch.status !== undefined) values.status = patch.status;
  if (patch.importedPosts !== undefined) values.importedPosts = patch.importedPosts;
  if (patch.rehostedImages !== undefined) values.rehostedImages = patch.rehostedImages;
  if (patch.failedPosts !== undefined) values.failedPosts = JSON.stringify(patch.failedPosts);
  if (patch.completedAt !== undefined) values.completedAt = patch.completedAt;

  const [row] = await db
    .update(wordpressImports)
    .set(values)
    .where(and(eq(wordpressImports.blogId, blogId), eq(wordpressImports.id, id)))
    .returning();

  return row ? toEntry(row) : null;
}
