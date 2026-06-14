import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { authors } from "@/db/schema/authors";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:authors");

type DB = DrizzleD1Database<typeof schema>;

/** API entry shape (matches the Author type from @repo/types). */
export interface AuthorEntry {
  id: string; // = slug
  name: string;
  jobTitle: string;
  bio: string;
  avatarUrl: string;
  email: string;
  sameAs: string[];
  createdAt: string;
  updatedAt: string;
}

type Row = typeof authors.$inferSelect;

function toEntry(row: Row): AuthorEntry {
  return {
    id: row.slug,
    name: row.name,
    jobTitle: row.jobTitle ?? "",
    bio: row.bio,
    avatarUrl: row.avatarUrl ?? "",
    email: row.email ?? "",
    sameAs: row.sameAs ? (JSON.parse(row.sameAs) as string[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAuthors(blogId: string, db: DB = getDb()): Promise<AuthorEntry[]> {
  const rows = await db
    .select()
    .from(authors)
    .where(eq(authors.blogId, blogId))
    .orderBy(asc(authors.name));
  return rows.map(toEntry);
}

export async function getAuthor(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<AuthorEntry | null> {
  const rows = await db
    .select()
    .from(authors)
    .where(and(eq(authors.blogId, blogId), eq(authors.slug, slug)))
    .limit(1);
  return rows[0] ? toEntry(rows[0]) : null;
}

export type CreateAuthorInput = {
  id: string; // the slug
  name: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  sameAs?: string[];
};

export async function createAuthor(
  blogId: string,
  input: CreateAuthorInput,
  db: DB = getDb(),
): Promise<{ ok: true; entry: AuthorEntry } | { ok: false; reason: "duplicate" }> {
  // Pre-check for duplicate (the UNIQUE index is the real guard against races).
  const existing = await db
    .select({ pk: authors.pk })
    .from(authors)
    .where(and(eq(authors.blogId, blogId), eq(authors.slug, input.id)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: "duplicate" };
  }

  try {
    const [row] = await db
      .insert(authors)
      .values({
        pk: nanoid(),
        blogId,
        slug: input.id,
        name: input.name,
        jobTitle: input.jobTitle ?? "",
        bio: input.bio ?? "",
        avatarUrl: input.avatarUrl ?? "",
        email: input.email ?? "",
        sameAs: input.sameAs ? JSON.stringify(input.sameAs) : null,
      })
      .returning();
    return { ok: true, entry: toEntry(row) };
  } catch (err) {
    // Concurrent insert may race past the pre-check; UNIQUE index is the real guard.
    if (String((err as Error)?.message ?? err).includes("UNIQUE constraint failed")) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export type UpdateAuthorInput = {
  name?: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  sameAs?: string[];
};

/** Caller must ensure `patch` has at least one field (route returns 400 otherwise).
 * Returns the updated entry, or null if no author with that slug exists. */
export async function updateAuthor(
  blogId: string,
  slug: string,
  patch: UpdateAuthorInput,
  db: DB = getDb(),
): Promise<AuthorEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.jobTitle !== undefined) updates.jobTitle = patch.jobTitle;
  if (patch.bio !== undefined) updates.bio = patch.bio;
  if (patch.avatarUrl !== undefined) updates.avatarUrl = patch.avatarUrl ?? "";
  if (patch.email !== undefined) updates.email = patch.email ?? "";
  if (patch.sameAs !== undefined) updates.sameAs = JSON.stringify(patch.sameAs);

  const [row] = await db
    .update(authors)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(and(eq(authors.blogId, blogId), eq(authors.slug, slug)))
    .returning();
  return row ? toEntry(row) : null;
}

export async function deleteAuthor(
  blogId: string,
  slug: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(authors)
    .where(and(eq(authors.blogId, blogId), eq(authors.slug, slug)))
    .returning({ pk: authors.pk });
  return rows.length > 0;
}

const PLACEHOLDER_AUTHOR_ID = "blogbat-editorial-team";

const PLACEHOLDER_AUTHOR = {
  name: "BlogBat Editorial Team",
  jobTitle: "Editorial Team",
  bio: "The BlogBat Editorial Team covers launching and growing small-business websites. Replace this placeholder with a real named author before launch.",
  avatarUrl: "",
  email: "",
  sameAs: ["https://blogbat.com"],
};

/**
 * Ensure the `authors` table has at least the placeholder entry for this blog.
 * Seeds on empty; idempotent. Swallows errors so it can never break a list request.
 */
export async function ensurePlaceholderAuthor(
  blogId: string,
  db: DB = getDb(),
): Promise<void> {
  try {
    const existing = await db
      .select({ pk: authors.pk })
      .from(authors)
      .where(eq(authors.blogId, blogId))
      .limit(1);
    if (existing.length > 0) return;

    await db
      .insert(authors)
      .values({
        pk: nanoid(),
        blogId,
        slug: PLACEHOLDER_AUTHOR_ID,
        name: PLACEHOLDER_AUTHOR.name,
        jobTitle: PLACEHOLDER_AUTHOR.jobTitle,
        bio: PLACEHOLDER_AUTHOR.bio,
        avatarUrl: PLACEHOLDER_AUTHOR.avatarUrl,
        email: PLACEHOLDER_AUTHOR.email,
        sameAs: JSON.stringify(PLACEHOLDER_AUTHOR.sameAs),
      })
      .onConflictDoNothing();
  } catch (err) {
    // Swallow — must never break a list request — but log for observability.
    log.error("Failed to seed placeholder author", {
      blogId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
