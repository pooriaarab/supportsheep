import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogInvites } from "@/db/schema/invites";

type DB = DrizzleD1Database<typeof schema>;

type Row = typeof blogInvites.$inferSelect;

/** How long an invite stays valid: 7 days from creation. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Roles an invite may grant. Invites are an external, email-delivered credential
 * so — like signup codes — they can never confer owner/admin. The most
 * privileged grant is "editor"; "author" is the default.
 */
const INVITABLE_ROLES = ["author", "editor", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function clampInviteRole(role: string): InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role)
    ? (role as InvitableRole)
    : "author";
}

export interface Invite {
  id: string;
  blogId: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: number;
  createdAt: number;
  acceptedAt: number | null;
  acceptedBy: string | null;
}

function toInvite(row: Row): Invite {
  return {
    id: row.id,
    blogId: row.blogId,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt ?? null,
    acceptedBy: row.acceptedBy ?? null,
  };
}

export interface CreateInviteInput {
  blogId: string;
  email: string;
  role: string;
  invitedBy: string;
}

/**
 * Create a pending invite for a blog.
 *
 * Role is clamped, not rejected: any non-invitable role (including "owner" and
 * "admin") falls back to "author" so an invite can never escalate privilege. The
 * email is lowercased so the later accept-time email match is case-insensitive.
 * The returned `token` is a random nanoid(32) — unguessable and the only
 * credential the accept link carries.
 */
export async function createInvite(
  input: CreateInviteInput,
  db: DB = getDb(),
): Promise<Invite> {
  const now = Date.now();
  const row = {
    id: nanoid(),
    blogId: input.blogId,
    email: input.email.toLowerCase(),
    role: clampInviteRole(input.role),
    token: nanoid(32),
    invitedBy: input.invitedBy,
    expiresAt: now + INVITE_TTL_MS,
    createdAt: now,
    acceptedAt: null,
    acceptedBy: null,
  };
  await db.insert(blogInvites).values(row);
  return toInvite(row);
}

/** Look up an invite by its token value, or null. */
export async function getInviteByToken(
  token: string,
  db: DB = getDb(),
): Promise<Invite | null> {
  const rows = await db
    .select()
    .from(blogInvites)
    .where(eq(blogInvites.token, token))
    .limit(1);
  return rows.length > 0 ? toInvite(rows[0]) : null;
}

/**
 * Pending (not-yet-accepted, not-expired) invites for a blog, newest first.
 * Scoped to a single blog — never returns other tenants' invites.
 */
export async function listPendingInvites(
  blogId: string,
  db: DB = getDb(),
): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(blogInvites)
    .where(
      and(eq(blogInvites.blogId, blogId), isNull(blogInvites.acceptedAt)),
    )
    .orderBy(desc(blogInvites.createdAt), desc(blogInvites.id));
  const now = Date.now();
  return rows.map(toInvite).filter((inv) => inv.expiresAt > now);
}

/** All invites sent to an email address (lowercased), newest first. */
export async function listInvitesByEmail(
  email: string,
  db: DB = getDb(),
): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(blogInvites)
    .where(eq(blogInvites.email, email.toLowerCase()))
    .orderBy(desc(blogInvites.createdAt), desc(blogInvites.id));
  return rows.map(toInvite);
}

export type AcceptInviteResult =
  | { ok: true; invite: Invite }
  | { ok: false; reason: "not_found" | "expired" | "already_accepted" };

/**
 * Atomically validate and consume an invite.
 *
 * Atomicity / single-use guard (same model as the signup-code redeemer):
 *   1. Read the row.
 *   2. Reject if missing (`not_found`), past `expiresAt` (`expired`), or already
 *      accepted (`already_accepted`).
 *   3. Mark accepted with a single guarded UPDATE — `SET accepted_at = ?,
 *      accepted_by = ? WHERE token = ? AND accepted_at IS NULL`. The
 *      `accepted_at IS NULL` predicate is evaluated atomically at the SQLite row
 *      level, so even if two accepts read the same pending row, only the first
 *      write takes effect; the loser sees zero affected rows → `already_accepted`.
 *
 * Caller is responsible for adding the membership (this only consumes the
 * invite); the route does both so a failed membership insert never leaves an
 * invite spent without a corresponding member.
 */
export async function acceptInvite(
  token: string,
  userId: string,
  db: DB = getDb(),
): Promise<AcceptInviteResult> {
  const existing = await getInviteByToken(token, db);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.acceptedAt !== null) {
    return { ok: false, reason: "already_accepted" };
  }
  if (existing.expiresAt <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const acceptedAt = Date.now();
  const updated = await db
    .update(blogInvites)
    .set({ acceptedAt, acceptedBy: userId })
    .where(
      and(eq(blogInvites.token, token), isNull(blogInvites.acceptedAt)),
    )
    .returning();

  if (updated.length === 0) {
    // A concurrent accept consumed the invite between our read and write.
    return { ok: false, reason: "already_accepted" };
  }

  return { ok: true, invite: toInvite(updated[0]) };
}

/**
 * Revoke (delete) a pending invite by token, scoped to a blog so one tenant can
 * never revoke another's invite. Returns whether a row was removed.
 */
export async function revokeInvite(
  blogId: string,
  token: string,
  db: DB = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(blogInvites)
    .where(and(eq(blogInvites.blogId, blogId), eq(blogInvites.token, token)))
    .returning({ id: blogInvites.id });
  return deleted.length > 0;
}
