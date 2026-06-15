import "server-only";

import { asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogMembers, blogs } from "@/db/schema/tenancy";

type DB = DrizzleD1Database<typeof schema>;

/**
 * Slugs that may never be claimed by a tenant. They collide with platform
 * subdomains/paths (www, app, api, …) or the seeded demo blog (`default`).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "admin",
  "api",
  "staging",
  "blog",
  "dashboard",
  "mail",
  "smtp",
  "support",
  "help",
  "docs",
  "static",
  "assets",
  "cdn",
  "img",
  "images",
  "media",
  "account",
  "settings",
  "login",
  "signup",
  "auth",
  "default",
]);

/**
 * A blog a user belongs to, with their role on it. Returned by createBlog and
 * listBlogsForUser.
 */
export interface BlogEntry {
  id: string;
  slug: string;
  displayName: string;
  role: string;
}

export type SlugValidation =
  | { ok: true }
  | { ok: false; reason: "invalid_format" | "reserved" };

// 3–32 chars, lowercase alphanumeric with internal single hyphens only:
// no leading/trailing hyphen, no double hyphen.
const SLUG_PATTERN = /^[a-z0-9](?:-?[a-z0-9])*$/;

/**
 * Validate a tenant slug. Slugs are lowercased before checking; format is
 * 3–32 chars, alphanumeric with internal hyphens (no leading/trailing/double
 * hyphen). Reserved slugs are rejected.
 */
export function validateSlug(slug: string): SlugValidation {
  const normalized = slug.toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 32 ||
    !SLUG_PATTERN.test(normalized)
  ) {
    return { ok: false, reason: "invalid_format" };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true };
}

/** True when no blog already owns this (lowercased) slug. */
export async function slugAvailable(
  slug: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .select({ id: blogs.id })
    .from(blogs)
    .where(eq(blogs.slug, slug.toLowerCase()))
    .limit(1);
  return rows.length === 0;
}

export interface CreateBlogInput {
  slug: string;
  displayName: string;
  ownerUserId: string;
}

export type CreateBlogResult =
  | { ok: true; blog: BlogEntry }
  | { ok: false; reason: "invalid_format" | "reserved" | "slug_taken" };

/**
 * Create a blog and its owner membership atomically.
 *
 * The slug is validated, then the knowledge bases row and the creator's owner
 * blog_members row are written in a single `db.batch` so a partial failure can
 * never leave a blog without an owner. The UNIQUE(slug) index is the real guard
 * against a concurrent claim (TOCTOU): we pre-check `slugAvailable` for a
 * friendly path, but a UNIQUE violation on insert maps to `slug_taken`.
 */
export async function createBlog(
  { slug, displayName, ownerUserId }: CreateBlogInput,
  db: DB = getDb(),
): Promise<CreateBlogResult> {
  const validation = validateSlug(slug);
  if (!validation.ok) return validation;

  const normalizedSlug = slug.toLowerCase();
  if (!(await slugAvailable(normalizedSlug, db))) {
    return { ok: false, reason: "slug_taken" };
  }

  const blogId = nanoid();
  try {
    await db.batch([
      db.insert(blogs).values({
        id: blogId,
        slug: normalizedSlug,
        displayName,
      }),
      db.insert(blogMembers).values({
        id: nanoid(),
        blogId,
        userId: ownerUserId,
        role: "owner",
      }),
    ]);
  } catch (err) {
    // A concurrent insert can race past the pre-check above; the UNIQUE(slug)
    // index is the real guard — treat its violation as a taken slug.
    if (
      String((err as Error)?.message ?? err).includes("UNIQUE constraint failed")
    ) {
      return { ok: false, reason: "slug_taken" };
    }
    throw err;
  }

  return {
    ok: true,
    blog: { id: blogId, slug: normalizedSlug, displayName, role: "owner" },
  };
}

/** A blog's display name by id, or null when no such blog exists. */
export async function getBlogDisplayName(
  blogId: string,
  db: DB = getDb(),
): Promise<string | null> {
  const rows = await db
    .select({ displayName: blogs.displayName })
    .from(blogs)
    .where(eq(blogs.id, blogId))
    .limit(1);
  return rows.length > 0 ? rows[0].displayName : null;
}

/**
 * Blogs the user is a member of, with their per-blog role. Ordered by the
 * blog's createdAt then id so the result is deterministic.
 */
export async function listBlogsForUser(
  userId: string,
  db: DB = getDb(),
): Promise<BlogEntry[]> {
  return db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      displayName: blogs.displayName,
      role: blogMembers.role,
    })
    .from(blogMembers)
    .innerJoin(blogs, eq(blogMembers.blogId, blogs.id))
    .where(eq(blogMembers.userId, userId))
    .orderBy(asc(blogs.createdAt), asc(blogs.id));
}
