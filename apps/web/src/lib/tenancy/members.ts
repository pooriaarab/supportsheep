import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { user } from "@/db/schema/auth";
import { blogMembers } from "@/db/schema/tenancy";

type DB = DrizzleD1Database<typeof schema>;

/**
 * A member of a blog: their blog_members role joined with their Better Auth
 * user profile. `id` is the userId (the client `AppUser` shape keys on it).
 * `status` is always "active" — membership has no paused/deleted state in the
 * D1 model (a non-member simply has no row).
 */
export interface MemberEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  joinedAt: string;
  status: "active";
}

function toMemberEntry(row: {
  userId: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  createdAt: string;
}): MemberEntry {
  return {
    id: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: row.image ?? "",
    joinedAt: row.createdAt,
    status: "active",
  };
}

const memberColumns = {
  userId: blogMembers.userId,
  name: user.name,
  email: user.email,
  role: blogMembers.role,
  image: user.image,
  createdAt: blogMembers.createdAt,
};

/**
 * Members of `blogId`, newest membership first. Inner-joins blog_members with
 * the Better Auth user table; ordered by createdAt desc then id so the result
 * is deterministic. Scoped to a single blog — never returns other tenants' rows.
 */
export async function listBlogMembers(
  blogId: string,
  { limit, offset }: { limit?: number; offset?: number } = {},
  db: DB = getDb(),
): Promise<MemberEntry[]> {
  let query = db
    .select(memberColumns)
    .from(blogMembers)
    .innerJoin(user, eq(blogMembers.userId, user.id))
    .where(eq(blogMembers.blogId, blogId))
    .orderBy(desc(blogMembers.createdAt), asc(blogMembers.id))
    .$dynamic();

  if (limit !== undefined) query = query.limit(limit);
  if (offset !== undefined) query = query.offset(offset);

  const rows = await query;
  return rows.map(toMemberEntry);
}

/** A single member of `blogId` by userId, or null when not a member. */
export async function getBlogMember(
  blogId: string,
  userId: string,
  db: DB = getDb(),
): Promise<MemberEntry | null> {
  const rows = await db
    .select(memberColumns)
    .from(blogMembers)
    .innerJoin(user, eq(blogMembers.userId, user.id))
    .where(and(eq(blogMembers.blogId, blogId), eq(blogMembers.userId, userId)))
    .limit(1);
  return rows.length > 0 ? toMemberEntry(rows[0]) : null;
}

/** Count of owners on a blog. Guards the last-owner protection. */
async function countOwners(blogId: string, db: DB): Promise<number> {
  const owners = await db
    .select({ userId: blogMembers.userId })
    .from(blogMembers)
    .where(and(eq(blogMembers.blogId, blogId), eq(blogMembers.role, "owner")));
  return owners.length;
}

export type UpdateMemberRoleResult =
  | { ok: true; member: MemberEntry }
  | { ok: false; reason: "not_found" | "last_owner" };

/**
 * Change a member's role on a blog. Blocks demoting the knowledge base's last owner: if
 * the target is currently the only owner and the new role is not "owner", the
 * update is refused with `last_owner` so a blog can never be left ownerless.
 */
export async function updateMemberRole(
  blogId: string,
  userId: string,
  role: string,
  db: DB = getDb(),
): Promise<UpdateMemberRoleResult> {
  const current = await getBlogMember(blogId, userId, db);
  if (!current) return { ok: false, reason: "not_found" };

  if (current.role === "owner" && role !== "owner") {
    if ((await countOwners(blogId, db)) <= 1) {
      return { ok: false, reason: "last_owner" };
    }
  }

  await db
    .update(blogMembers)
    .set({ role })
    .where(and(eq(blogMembers.blogId, blogId), eq(blogMembers.userId, userId)));

  const member = await getBlogMember(blogId, userId, db);
  // member is non-null: the row exists (we just read it above) and the update
  // changes only the role, never the key.
  return { ok: true, member: member! };
}

export type RemoveBlogMembersResult =
  | { ok: true; removed: number }
  | { ok: false; reason: "last_owner" };

/**
 * Remove memberships from a blog. Refuses if the removal set would delete the
 * blog's last remaining owner (leaving it ownerless) — returns `last_owner`.
 * Otherwise deletes the matching rows and returns how many were removed.
 */
export async function removeBlogMembers(
  blogId: string,
  userIds: string[],
  db: DB = getDb(),
): Promise<RemoveBlogMembersResult> {
  if (userIds.length === 0) return { ok: true, removed: 0 };

  const owners = await db
    .select({ userId: blogMembers.userId })
    .from(blogMembers)
    .where(and(eq(blogMembers.blogId, blogId), eq(blogMembers.role, "owner")));

  const removingIds = new Set(userIds);
  const remainingOwners = owners.filter((o) => !removingIds.has(o.userId));
  if (owners.length > 0 && remainingOwners.length === 0) {
    return { ok: false, reason: "last_owner" };
  }

  const deleted = await db
    .delete(blogMembers)
    .where(
      and(
        eq(blogMembers.blogId, blogId),
        inArray(blogMembers.userId, userIds),
      ),
    )
    .returning({ id: blogMembers.id });

  return { ok: true, removed: deleted.length };
}

export type AddMemberByEmailResult =
  | { ok: true; member: MemberEntry }
  | { ok: false; reason: "user_not_found" | "already_member" };

/**
 * Add an existing user (looked up by email) to a blog with the given role. The
 * person must already have an account — email invites for non-users are a later
 * slice, so a missing user returns `user_not_found`. A user who is already a
 * member returns `already_member`.
 */
export async function addMemberByEmail(
  blogId: string,
  email: string,
  role: string,
  db: DB = getDb(),
): Promise<AddMemberByEmailResult> {
  const found = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (found.length === 0) return { ok: false, reason: "user_not_found" };

  const userId = found[0].id;
  const inserted = await db
    .insert(blogMembers)
    .values({ blogId, userId, role })
    .onConflictDoNothing({
      target: [blogMembers.blogId, blogMembers.userId],
    })
    .returning({ id: blogMembers.id });

  if (inserted.length === 0) return { ok: false, reason: "already_member" };

  const member = await getBlogMember(blogId, userId, db);
  return { ok: true, member: member! };
}
