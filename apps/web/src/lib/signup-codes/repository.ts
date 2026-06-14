import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { signupCodes } from "@/db/schema/signup-codes";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:signup-codes");

type DB = DrizzleD1Database<typeof schema>;

type Row = typeof signupCodes.$inferSelect;

/**
 * Roles a signup code may grant. Codes are a low-trust, shareable credential, so
 * they can never confer owner/admin — the most privileged grant is "editor".
 * "author" is the default for agents that just publish content.
 */
const GRANTABLE_ROLES = ["author", "editor", "viewer"] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export function isGrantableRole(role: string): role is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

export interface SignupCode {
  id: string;
  code: string;
  blogId: string;
  role: string;
  note: string | null;
  maxUses: number;
  uses: number;
  expiresAt: number | null;
  createdBy: string;
  createdAt: number;
}

function toSignupCode(row: Row): SignupCode {
  return {
    id: row.id,
    code: row.code,
    blogId: row.blogId,
    role: row.role,
    note: row.note ?? null,
    maxUses: row.maxUses,
    uses: row.uses,
    expiresAt: row.expiresAt ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export type CreateSignupCodeInput = {
  blogId: string;
  role: string;
  note?: string;
  maxUses?: number;
  expiresAtMs?: number | null;
  createdBy: string;
};

/**
 * Issue a new signup code for a blog.
 *
 * Role is clamped, not rejected: any non-grantable role (including "owner" and
 * "admin") falls back to "author" so a code can never escalate privilege. The
 * returned `code` is a random nanoid(24) — unguessable and meant to be shared
 * with the redeemer; it is the only credential the code exposes.
 */
export async function createSignupCode(
  input: CreateSignupCodeInput,
  db: DB = getDb(),
): Promise<SignupCode> {
  const role = isGrantableRole(input.role) ? input.role : "author";
  const id = nanoid();
  const code = nanoid(24);
  const maxUses = input.maxUses && input.maxUses > 0 ? input.maxUses : 1;
  const row = {
    id,
    code,
    blogId: input.blogId,
    role,
    note: input.note ?? null,
    maxUses,
    uses: 0,
    expiresAt: input.expiresAtMs ?? null,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };

  await db.insert(signupCodes).values(row);
  // Never log the code value itself — it is a shareable secret.
  log.info("Created signup code", { id, blogId: input.blogId, role, maxUses });

  return toSignupCode(row);
}

/** Look up a code by its token value, or null. */
export async function getSignupCodeByCode(
  code: string,
  db: DB = getDb(),
): Promise<SignupCode | null> {
  const rows = await db
    .select()
    .from(signupCodes)
    .where(eq(signupCodes.code, code))
    .limit(1);
  return rows.length > 0 ? toSignupCode(rows[0]) : null;
}

/** All codes issued for a blog, newest first. Scoped — never returns other tenants' codes. */
export async function listSignupCodes(
  blogId: string,
  db: DB = getDb(),
): Promise<SignupCode[]> {
  const rows = await db
    .select()
    .from(signupCodes)
    .where(eq(signupCodes.blogId, blogId))
    .orderBy(desc(signupCodes.createdAt), desc(signupCodes.id));
  return rows.map(toSignupCode);
}

export type RedeemSignupCodeResult =
  | { ok: true; blogId: string; role: string }
  | { ok: false; reason: "not_found" | "expired" | "exhausted" };

/**
 * Atomically validate and consume one use of a code.
 *
 * Atomicity / over-use guard (same model as the free-tools usage limiter):
 *   1. Read the row.
 *   2. Reject if missing (`not_found`), past `expiresAt` (`expired`), or already
 *      at `uses >= maxUses` (`exhausted`).
 *   3. Increment with a single guarded UPDATE — `SET uses = uses + 1 WHERE
 *      id = ? AND uses < maxUses`. The `uses < maxUses` predicate is evaluated
 *      atomically at the SQLite row level, so even if two redemptions read the
 *      same pre-update value, only the writes that still satisfy the predicate
 *      take effect and `uses` can never exceed `maxUses`. If the guarded UPDATE
 *      affects zero rows, a concurrent redemption won the last slot → `exhausted`.
 *
 * Race tolerance: D1 is single-writer and the libsql `:memory:` test client is
 * single-threaded, so the read-then-guarded-write pattern is exact here. The
 * `WHERE uses < maxUses` clause is the real safety net under any concurrency.
 */
export async function redeemSignupCode(
  code: string,
  db: DB = getDb(),
): Promise<RedeemSignupCodeResult> {
  const rows = await db
    .select()
    .from(signupCodes)
    .where(eq(signupCodes.code, code))
    .limit(1);

  if (rows.length === 0) return { ok: false, reason: "not_found" };

  const row = rows[0];

  if (row.expiresAt !== null && row.expiresAt <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (row.uses >= row.maxUses) {
    return { ok: false, reason: "exhausted" };
  }

  // Guarded atomic increment: only succeeds while a use slot remains.
  const updated = await db
    .update(signupCodes)
    .set({ uses: sql`${signupCodes.uses} + 1` })
    .where(
      and(eq(signupCodes.id, row.id), sql`${signupCodes.uses} < ${row.maxUses}`),
    )
    .returning({ id: signupCodes.id });

  if (updated.length === 0) {
    // A concurrent redemption consumed the final slot between our read and write.
    return { ok: false, reason: "exhausted" };
  }

  return { ok: true, blogId: row.blogId, role: row.role };
}
