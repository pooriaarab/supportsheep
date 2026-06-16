import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogMembers } from "@/db/schema/tenancy";
import type { SessionData } from "@/lib/auth/session";

import { readActiveBlogHint } from "./active-blog";

type DB = DrizzleD1Database<typeof schema>;

/** The bootstrap blog seeded by the tenancy migration. */
export const DEFAULT_blog_id = "default";

/**
 * Thrown by resolveTenantForUser when an authenticated user has no blog
 * membership yet. createApiHandler maps this to a 409 `needs_onboarding`
 * response so the client can route the user to the onboarding flow.
 */
export class NeedsOnboardingError extends Error {
  constructor() {
    super("needs_onboarding");
    this.name = "NeedsOnboardingError";
  }
}

export interface Tenant {
  blogId: string;
  role: string;
}

/** The user's earliest membership, or null. (A user has exactly one membership
 * in the current bootstrap model; multi-blog selection is a later milestone.)
 * Ordered by createdAt so the result is deterministic once a user can belong
 * to more than one blog — never rely on SQLite's unordered LIMIT. */
export async function getMembershipByUser(
  userId: string,
  db: DB = getDb(),
): Promise<Tenant | null> {
  const rows = await db
    .select({ blogId: blogMembers.blogId, role: blogMembers.role })
    .from(blogMembers)
    .where(eq(blogMembers.userId, userId))
    .orderBy(asc(blogMembers.createdAt), asc(blogMembers.id))
    .limit(1);
  return rows.length > 0 ? { blogId: rows[0].blogId, role: rows[0].role } : null;
}

/** The user's membership on a specific blog, or null when they aren't a member. */
export async function getMembershipForBlog(
  userId: string,
  blogId: string,
  db: DB = getDb(),
): Promise<Tenant | null> {
  const rows = await db
    .select({ blogId: blogMembers.blogId, role: blogMembers.role })
    .from(blogMembers)
    .where(and(eq(blogMembers.userId, userId), eq(blogMembers.blogId, blogId)))
    .limit(1);
  return rows.length > 0 ? { blogId: rows[0].blogId, role: rows[0].role } : null;
}

/**
 * User IDs of members on `blogId` whose role is in `roles`. Used for fan-out
 * tasks like notifying every admin/editor. Returns [] for an empty role list.
 */
export async function listMemberUserIdsByRoles(
  blogId: string,
  roles: string[],
  db: DB = getDb(),
): Promise<string[]> {
  if (roles.length === 0) return [];
  const rows = await db
    .select({ userId: blogMembers.userId })
    .from(blogMembers)
    .where(and(eq(blogMembers.blogId, blogId), inArray(blogMembers.role, roles)));
  return rows.map((row) => row.userId);
}

/**
 * Resolve the tenant for an authenticated request via blog_members.
 *
 * active-blog selection: if a `bb_active_blog` cookie hint is present AND the
 * user is actually a member of that blog, that membership is returned. The
 * cookie is ONLY a hint — membership is always re-verified here, so a forged or
 * stale cookie can never grant access to a blog the user isn't in. When the hint
 * is absent or points at a blog the user no longer belongs to, this falls back
 * to the user's earliest membership.
 *
 * A user with no membership at all has not completed onboarding yet, so this
 * throws NeedsOnboardingError rather than silently auto-joining a shared blog —
 * new users create their own blog via the onboarding flow. createApiHandler maps
 * that error to a 409 `needs_onboarding`.
 *
 * `activeBlogHint` defaults to reading the cookie but is injectable for tests.
 */
export async function resolveTenantForUser(
  session: SessionData,
  db: DB = getDb(),
  activeBlogHint?: string | null,
): Promise<Tenant> {
  const hint =
    activeBlogHint !== undefined ? activeBlogHint : await readActiveBlogHint();

  if (hint) {
    // Re-verify membership: the cookie is never trusted for authz.
    const hinted = await getMembershipForBlog(session.uid, hint, db);
    if (hinted) return hinted;
  }

  const existing = await getMembershipByUser(session.uid, db);
  if (existing) return existing;

  throw new NeedsOnboardingError();
}
