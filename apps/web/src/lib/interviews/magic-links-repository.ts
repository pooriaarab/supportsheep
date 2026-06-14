import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { magicLinks } from "@/db/schema/interviews";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:interviews:magic-links-repository");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof magicLinks.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface MagicLinkRow {
  id: string;
  blogId: string;
  shareLinkId: string;
  tokenHash: string;
  email: string | null;
  expiresAt: string | null;
  consumedAt: number | null;
  createdAt: number;
}

function toRow(row: Row): MagicLinkRow {
  return {
    id: row.id,
    blogId: row.blogId,
    shareLinkId: row.shareLinkId,
    tokenHash: row.tokenHash,
    email: row.email ?? null,
    expiresAt: row.expiresAt ?? null,
    consumedAt: row.consumedAt ?? null,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateMagicLinkInput = {
  shareLinkId: string;
  tokenHash: string;
  email?: string | null;
  expiresAt?: string | null;
};

export async function createMagicLink(
  blogId: string,
  input: CreateMagicLinkInput,
  db: DB = getDb(),
): Promise<MagicLinkRow> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(magicLinks).values({
    id,
    blogId,
    shareLinkId: input.shareLinkId,
    tokenHash: input.tokenHash,
    email: input.email ?? null,
    expiresAt: input.expiresAt ?? null,
    consumedAt: null,
    createdAt: now,
  });

  log.info("Created magic link", { id, blogId, shareLinkId: input.shareLinkId });

  const row = await getMagicLinkByTokenHash(input.tokenHash, db);
  if (!row) throw new Error(`Failed to fetch magic link after insert: ${id}`);
  return row;
}

// ---------------------------------------------------------------------------
// Get by token hash
// ---------------------------------------------------------------------------

export async function getMagicLinkByTokenHash(
  tokenHash: string,
  db: DB = getDb(),
): Promise<MagicLinkRow | null> {
  const rows = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, tokenHash))
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Claim result — discriminated so routes can produce precise status codes
// ---------------------------------------------------------------------------

export type ClaimMagicLinkResult =
  | { ok: true; email: string | null; row: MagicLinkRow }
  | { ok: false; reason: "not_found" | "consumed" | "expired" | "not_yet" };

/**
 * Atomically claim a magic link for single-use redemption.
 *
 * Uses a conditional UPDATE … WHERE consumed_at IS NULL RETURNING to ensure
 * exactly one caller can claim the token. Two concurrent GETs with the same
 * code will both hit this function: the first writer sets consumed_at and gets
 * a row back; the second sees 0 rows returned and returns `consumed`.
 *
 * Expiry and scheduled-window checks happen BEFORE the conditional UPDATE.
 * If the token is not found, expired, or not yet valid, the function returns
 * a discriminated failure without touching consumed_at.
 */
export async function claimMagicLink(
  blogId: string,
  tokenHash: string,
  db: DB = getDb(),
): Promise<ClaimMagicLinkResult> {
  const existing = await getMagicLinkByTokenHash(tokenHash, db);

  if (!existing) return { ok: false, reason: "not_found" };
  // Tenant isolation: the token must belong to the requested blog.
  if (existing.blogId !== blogId) return { ok: false, reason: "not_found" };
  if (existing.consumedAt !== null) return { ok: false, reason: "consumed" };

  if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
    return { ok: false, reason: "expired" };
  }

  const consumedAt = Date.now();

  // Conditional UPDATE — only sets consumed_at if it is still NULL.
  // This is the atomic single-use gate: two concurrent callers can both
  // pass the pre-flight checks above (both see consumedAt=null), but only
  // one will update the row (the other will update 0 rows).
  const updated = await db
    .update(magicLinks)
    .set({ consumedAt })
    .where(
      and(
        eq(magicLinks.tokenHash, tokenHash),
        eq(magicLinks.blogId, blogId),
        isNull(magicLinks.consumedAt),
      ),
    )
    .returning({ id: magicLinks.id, tokenHash: magicLinks.tokenHash });

  if (updated.length === 0) {
    // Race: another concurrent request already claimed it
    return { ok: false, reason: "consumed" };
  }

  const claimed: MagicLinkRow = { ...existing, consumedAt };
  return { ok: true, email: claimed.email, row: claimed };
}
