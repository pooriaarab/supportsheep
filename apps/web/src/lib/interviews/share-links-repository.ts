import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { shareLinks } from "@/db/schema/interviews";
import { createLogger } from "@/lib/logger";
import type {
  AuthMode,
  InterviewLanguage,
  InterviewStyle,
  RecordingConfig,
  ShareLinkStatus,
  ShareLinkVisibility,
} from "./share-link-schema";

const log = createLogger("lib:interviews:share-links-repository");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof shareLinks.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface ShareLinkRow {
  id: string;
  blogId: string;
  type: ShareLinkVisibility;
  createdBy: string;
  workspaceId: string;
  topic: string | null;
  goal: string | null;
  style: InterviewStyle;
  authMode: AuthMode;
  recordingConfig: RecordingConfig;
  maxDurationSec: number;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  status: ShareLinkStatus;
  tokenHash: string;
  language: InterviewLanguage;
  scheduledAt: string | null;
  scheduledGuestEmail: string | null;
  mode: "live" | "async";
  asyncQuestions: Array<{ id: string; text: string; audioStoragePath: string }> | null;
  createdAt: number;
  updatedAt: number;
}

function toRow(row: Row): ShareLinkRow {
  return {
    id: row.id,
    blogId: row.blogId,
    type: row.type as ShareLinkVisibility,
    createdBy: row.createdBy,
    workspaceId: row.workspaceId,
    topic: row.topic ?? null,
    goal: row.goal ?? null,
    style: row.style as InterviewStyle,
    authMode: row.authMode as AuthMode,
    recordingConfig: row.recordingConfig as RecordingConfig,
    maxDurationSec: row.maxDurationSec,
    expiresAt: row.expiresAt ?? null,
    maxUses: row.maxUses ?? null,
    uses: row.uses,
    status: row.status as ShareLinkStatus,
    tokenHash: row.tokenHash,
    language: row.language as InterviewLanguage,
    scheduledAt: row.scheduledAt ?? null,
    scheduledGuestEmail: row.scheduledGuestEmail ?? null,
    mode: (row.mode as "live" | "async") ?? "live",
    asyncQuestions: row.asyncQuestions
      ? (JSON.parse(row.asyncQuestions) as Array<{
          id: string;
          text: string;
          audioStoragePath: string;
        }>)
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateShareLinkInput = {
  type: ShareLinkVisibility;
  createdBy: string;
  workspaceId?: string;
  topic?: string | null;
  goal?: string | null;
  style?: InterviewStyle;
  authMode?: AuthMode;
  recordingConfig?: RecordingConfig;
  maxDurationSec?: number;
  expiresAt?: string | null;
  maxUses?: number | null;
  tokenHash: string;
  language?: InterviewLanguage;
  scheduledAt?: string | null;
  scheduledGuestEmail?: string | null;
  mode?: "live" | "async";
  asyncQuestions?: Array<{ id: string; text: string; audioStoragePath: string }> | null;
};

export async function createShareLink(
  blogId: string,
  input: CreateShareLinkInput,
  db: DB = getDb(),
): Promise<ShareLinkRow> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(shareLinks).values({
    id,
    blogId,
    type: input.type,
    createdBy: input.createdBy,
    workspaceId: input.workspaceId ?? "default",
    topic: input.topic ?? null,
    goal: input.goal ?? null,
    style: input.style ?? "smart",
    authMode: input.authMode ?? "anonymous",
    recordingConfig: input.recordingConfig ?? "transcript",
    maxDurationSec: input.maxDurationSec ?? 300,
    expiresAt: input.expiresAt ?? null,
    maxUses: input.maxUses ?? null,
    uses: 0,
    status: "active",
    tokenHash: input.tokenHash,
    language: input.language ?? "en",
    scheduledAt: input.scheduledAt ?? null,
    scheduledGuestEmail: input.scheduledGuestEmail ?? null,
    mode: input.mode ?? "live",
    asyncQuestions: input.asyncQuestions
      ? JSON.stringify(input.asyncQuestions)
      : null,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created share link", { id, blogId });

  const row = await getShareLink(blogId, id, db);
  if (!row) throw new Error(`Failed to fetch share link after insert: ${id}`);
  return row;
}

// ---------------------------------------------------------------------------
// Get by id
// ---------------------------------------------------------------------------

export async function getShareLink(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<ShareLinkRow | null> {
  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)))
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Get by token hash (global — token_hash is globally unique)
// ---------------------------------------------------------------------------

export async function getShareLinkByTokenHash(
  tokenHash: string,
  db: DB = getDb(),
): Promise<ShareLinkRow | null> {
  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash))
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateShareLinkInput = {
  status?: ShareLinkStatus;
  topic?: string | null;
  goal?: string | null;
  style?: InterviewStyle;
  maxDurationSec?: number;
  expiresAt?: string | null;
  maxUses?: number | null;
  language?: InterviewLanguage;
};

export async function updateShareLink(
  blogId: string,
  id: string,
  patch: UpdateShareLinkInput,
  db: DB = getDb(),
): Promise<ShareLinkRow | null> {
  const now = Date.now();
  const updates: Partial<typeof shareLinks.$inferInsert> = { updatedAt: now };

  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.topic !== undefined) updates.topic = patch.topic ?? undefined;
  if (patch.goal !== undefined) updates.goal = patch.goal ?? undefined;
  if (patch.style !== undefined) updates.style = patch.style;
  if (patch.maxDurationSec !== undefined) updates.maxDurationSec = patch.maxDurationSec;
  if ("expiresAt" in patch) updates.expiresAt = patch.expiresAt ?? undefined;
  if ("maxUses" in patch) updates.maxUses = patch.maxUses ?? undefined;
  if (patch.language !== undefined) updates.language = patch.language;

  await db
    .update(shareLinks)
    .set(updates)
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)));

  return getShareLink(blogId, id, db);
}

// ---------------------------------------------------------------------------
// Increment uses (atomic)
// ---------------------------------------------------------------------------

export async function incrementShareLinkUses(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(shareLinks)
    .set({
      uses: sql`${shareLinks.uses} + 1`,
      updatedAt: Date.now(),
    })
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)));
}

// ---------------------------------------------------------------------------
// List (by blog, optionally by creator)
// ---------------------------------------------------------------------------

export async function listShareLinks(
  blogId: string,
  opts: { createdBy?: string; status?: ShareLinkStatus; limit?: number } = {},
  db: DB = getDb(),
): Promise<ShareLinkRow[]> {
  const limit = opts.limit ?? 200;

  const conditions = [eq(shareLinks.blogId, blogId)];
  if (opts.status) conditions.push(eq(shareLinks.status, opts.status));
  if (opts.createdBy) conditions.push(eq(shareLinks.createdBy, opts.createdBy));

  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(...conditions))
    .orderBy(desc(shareLinks.createdAt), desc(shareLinks.id))
    .limit(limit);

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Rotate token (regenerate)
// ---------------------------------------------------------------------------

/**
 * Replace the tokenHash and reset uses to 0 atomically.
 * Called by the regenerate route to invalidate the old plaintext token.
 */
export async function rotateShareLinkToken(
  blogId: string,
  id: string,
  newTokenHash: string,
  db: DB = getDb(),
): Promise<ShareLinkRow | null> {
  const now = Date.now();

  await db
    .update(shareLinks)
    .set({ tokenHash: newTokenHash, uses: 0, updatedAt: now })
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)));

  return getShareLink(blogId, id, db);
}

// ---------------------------------------------------------------------------
// Update asyncQuestions (array append)
// ---------------------------------------------------------------------------

export type AsyncQuestion = { id: string; text: string; audioStoragePath: string };

/**
 * Append a question to the share link's asyncQuestions JSON array.
 */
export async function appendAsyncQuestion(
  blogId: string,
  id: string,
  question: AsyncQuestion,
  db: DB = getDb(),
): Promise<ShareLinkRow | null> {
  const existing = await getShareLink(blogId, id, db);
  if (!existing) return null;

  const questions = existing.asyncQuestions ?? [];
  const updated = [...questions, question];

  await db
    .update(shareLinks)
    .set({ asyncQuestions: JSON.stringify(updated), updatedAt: Date.now() })
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)));

  return getShareLink(blogId, id, db);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteShareLink(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)))
    .returning({ id: shareLinks.id });

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a share link is usable for starting an interview.
 * Returns null if valid; returns an error string if not.
 */
export function validateShareLinkForUse(
  link: ShareLinkRow,
): string | null {
  if (link.status !== "active") return "Share-link not active";
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return "Share-link expired";
  if (link.maxUses !== null && link.uses >= link.maxUses) return "Share-link uses exhausted";
  return null;
}

/**
 * Check if the scheduled window is in the future (block joining early).
 */
export function isShareLinkScheduledFuture(link: ShareLinkRow): boolean {
  return !!(link.scheduledAt && new Date(link.scheduledAt) > new Date());
}

// ---------------------------------------------------------------------------
// Atomic: increment uses + create interview atomically
// D1 doesn't expose multi-statement user transactions, so we use a two-step
// approach: conditional UPDATE (checking max_uses constraint) then INSERT.
// The conditional update acts as a compare-and-swap to prevent overshooting.
// ---------------------------------------------------------------------------

/**
 * Atomically increment share link uses, guarding against maxUses exhaustion.
 * Returns false if the link was already at capacity (race guard).
 */
export async function atomicIncrementUsesIfAvailable(
  blogId: string,
  id: string,
  currentUses: number,
  maxUses: number | null,
  db: DB = getDb(),
): Promise<boolean> {
  const now = Date.now();

  if (maxUses === null) {
    // Unlimited uses — simple increment
    await db
      .update(shareLinks)
      .set({ uses: sql`${shareLinks.uses} + 1`, updatedAt: now })
      .where(and(eq(shareLinks.blogId, blogId), eq(shareLinks.id, id)));
    return true;
  }

  // Conditional increment: only update if uses < maxUses
  // We check uses == currentUses AND uses < maxUses for the compare-and-swap
  const updated = await db
    .update(shareLinks)
    .set({ uses: sql`${shareLinks.uses} + 1`, updatedAt: now })
    .where(
      and(
        eq(shareLinks.blogId, blogId),
        eq(shareLinks.id, id),
        eq(shareLinks.uses, currentUses),
        sql`${shareLinks.uses} < ${maxUses}`,
      ),
    )
    .returning({ id: shareLinks.id });

  return updated.length > 0;
}
