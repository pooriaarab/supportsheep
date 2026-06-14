import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { interviews } from "@/db/schema/interviews";
import { createLogger } from "@/lib/logger";
import type { InterviewLanguage, InterviewStyle } from "./share-link-schema";

const log = createLogger("lib:interviews:repository");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof interviews.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface InterviewRow {
  id: string;
  blogId: string;
  status: string;
  startedByUid: string | null;
  startedByRole: string | null;
  shareLinkId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  topic: string | null;
  goal: string | null;
  style: InterviewStyle;
  recordingConfig: string;
  language: InterviewLanguage;
  mode: "live" | "async";
  maxDurationSec: number;
  canvasSnapshot: Record<string, unknown> | null;
  canvasSnapshotAt: number | null;
  articleId: string | null;
  publishedDirect: boolean | null;
  requiresReview: boolean | null;
  endedAt: number | null;
  startedAt: number | null;
  responsesCount: number;
  videoProvider: string | null;
  tavusConversationId: string | null;
  videoStoragePath: string | null;
  costUsd: number | null;
  createdAt: number;
  updatedAt: number;
}

function toRow(row: Row): InterviewRow {
  return {
    id: row.id,
    blogId: row.blogId,
    status: row.status,
    startedByUid: row.startedByUid ?? null,
    startedByRole: row.startedByRole ?? null,
    shareLinkId: row.shareLinkId ?? null,
    guestEmail: row.guestEmail ?? null,
    guestName: row.guestName ?? null,
    topic: row.topic ?? null,
    goal: row.goal ?? null,
    style: (row.style as InterviewStyle) ?? "smart",
    recordingConfig: row.recordingConfig,
    language: (row.language as InterviewLanguage) ?? "en",
    mode: (row.mode as "live" | "async") ?? "live",
    maxDurationSec: row.maxDurationSec,
    canvasSnapshot: row.canvasSnapshot
      ? (JSON.parse(row.canvasSnapshot) as Record<string, unknown>)
      : null,
    canvasSnapshotAt: row.canvasSnapshotAt ?? null,
    articleId: row.articleId ?? null,
    publishedDirect: row.publishedDirect != null ? row.publishedDirect === 1 : null,
    requiresReview: row.requiresReview != null ? row.requiresReview === 1 : null,
    endedAt: row.endedAt ?? null,
    startedAt: row.startedAt ?? null,
    responsesCount: row.responsesCount,
    videoProvider: row.videoProvider ?? null,
    tavusConversationId: row.tavusConversationId ?? null,
    videoStoragePath: row.videoStoragePath ?? null,
    costUsd: row.costUsd ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateInterviewInput = {
  id?: string;
  blogId?: string;
  status?: string;
  startedByUid?: string | null;
  startedByRole?: string | null;
  shareLinkId?: string | null;
  guestEmail?: string | null;
  guestName?: string | null;
  topic?: string | null;
  goal?: string | null;
  style?: InterviewStyle;
  recordingConfig?: string;
  language?: InterviewLanguage;
  mode?: "live" | "async";
  maxDurationSec?: number;
};

export async function createInterview(
  blogId: string,
  input: CreateInterviewInput,
  db: DB = getDb(),
): Promise<InterviewRow> {
  const id = input.id ?? nanoid();
  const now = Date.now();

  await db.insert(interviews).values({
    id,
    blogId: input.blogId ?? blogId,
    status: input.status ?? "consent",
    startedByUid: input.startedByUid ?? null,
    startedByRole: input.startedByRole ?? null,
    shareLinkId: input.shareLinkId ?? null,
    guestEmail: input.guestEmail ?? null,
    guestName: input.guestName ?? null,
    topic: input.topic ?? null,
    goal: input.goal ?? null,
    style: input.style ?? "smart",
    recordingConfig: input.recordingConfig ?? "transcript",
    language: input.language ?? "en",
    mode: input.mode ?? "live",
    maxDurationSec: input.maxDurationSec ?? 300,
    responsesCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created interview", { id, blogId });

  const row = await getInterview(blogId, id, db);
  if (!row) throw new Error(`Failed to fetch interview after insert: ${id}`);
  return row;
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getInterview(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<InterviewRow | null> {
  const rows = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.blogId, blogId), eq(interviews.id, id)))
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

/**
 * Look up an interview by its Tavus conversation id (set when a video
 * interview is provisioned). Used by the Tavus recording webhook to attach the
 * uploaded recording to the right interview. Scoped to a single blog.
 */
export async function getInterviewByTavusConversationId(
  blogId: string,
  conversationId: string,
  db: DB = getDb(),
): Promise<InterviewRow | null> {
  const rows = await db
    .select()
    .from(interviews)
    .where(
      and(
        eq(interviews.blogId, blogId),
        eq(interviews.tavusConversationId, conversationId),
      ),
    )
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateInterviewInput = {
  status?: string;
  startedAt?: number | null;
  endedAt?: number | null;
  videoProvider?: string | null;
  tavusConversationId?: string | null;
  videoStoragePath?: string | null;
  canvasSnapshot?: Record<string, unknown> | null;
  canvasSnapshotAt?: number | null;
  articleId?: string | null;
  publishedDirect?: boolean | null;
  requiresReview?: boolean | null;
  costUsd?: number | null;
};

export async function updateInterview(
  blogId: string,
  id: string,
  patch: UpdateInterviewInput,
  db: DB = getDb(),
): Promise<InterviewRow | null> {
  const now = Date.now();

  const updates: Partial<typeof interviews.$inferInsert> = {
    updatedAt: now,
  };

  if (patch.status !== undefined) updates.status = patch.status;
  if ("startedAt" in patch) updates.startedAt = patch.startedAt ?? undefined;
  if ("endedAt" in patch) updates.endedAt = patch.endedAt ?? undefined;
  if ("videoProvider" in patch) updates.videoProvider = patch.videoProvider ?? undefined;
  if ("tavusConversationId" in patch) updates.tavusConversationId = patch.tavusConversationId ?? undefined;
  if ("videoStoragePath" in patch) updates.videoStoragePath = patch.videoStoragePath ?? undefined;
  if ("canvasSnapshot" in patch)
    updates.canvasSnapshot = patch.canvasSnapshot
      ? JSON.stringify(patch.canvasSnapshot)
      : undefined;
  if ("canvasSnapshotAt" in patch)
    updates.canvasSnapshotAt = patch.canvasSnapshotAt ?? undefined;
  if ("articleId" in patch) updates.articleId = patch.articleId ?? undefined;
  if ("publishedDirect" in patch)
    updates.publishedDirect =
      patch.publishedDirect != null ? (patch.publishedDirect ? 1 : 0) : undefined;
  if ("requiresReview" in patch)
    updates.requiresReview =
      patch.requiresReview != null ? (patch.requiresReview ? 1 : 0) : undefined;
  if ("costUsd" in patch) updates.costUsd = patch.costUsd ?? undefined;

  await db
    .update(interviews)
    .set(updates)
    .where(and(eq(interviews.blogId, blogId), eq(interviews.id, id)));

  return getInterview(blogId, id, db);
}

// ---------------------------------------------------------------------------
// Consent status transition (consent → live)
// ---------------------------------------------------------------------------

export type ConsentTransitionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "conflict" | "cost_cap_exceeded" };

/**
 * Transition an interview from "consent" → "live".
 *
 * Status flip — idempotent (atomic): the conditional
 * `UPDATE ... WHERE status = 'consent'` only mutates the row when it is still
 * in consent state, and the returned row count tells us whether THIS call won.
 * Two concurrent consents therefore can never both flip the same interview —
 * the loser gets `conflict`. This guarantee is solid.
 *
 * Cost cap — SOFT / best-effort (NOT atomic): the `SELECT sum(cost_usd)` runs
 * as a plain read BEFORE the conditional UPDATE, not inside a transaction with
 * it (D1 doesn't expose multi-statement userland transactions). Two concurrent
 * consents on DIFFERENT interviews can both read a pre-write total under the
 * cap and both transition, marginally overshooting `monthlyCostCapUsd`. The
 * original Firestore code ran this read inside the same transaction as the
 * write and so gave a hard cap; this implementation does not.
 *
 * TODO(M2-scale): if a hard monthly cost cap is required under concurrency,
 * gate it with a D1 write-lock / serialized counter row rather than a plain
 * read-then-write.
 */
export async function consentToLive(
  blogId: string,
  id: string,
  monthlyCostCapUsd: number | null,
  db: DB = getDb(),
): Promise<ConsentTransitionResult> {
  // 1. Verify the interview exists and is in consent state
  const existing = await getInterview(blogId, id, db);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status !== "consent") return { ok: false, reason: "conflict" };

  // 2. Cost cap check — SOFT / best-effort (see function docstring). Plain read
  //    before the write, NOT atomic with it. TODO(M2-scale): harden if needed.
  if (monthlyCostCapUsd !== null) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthMs = startOfMonth.getTime();

    const result = await db
      .select({ totalCost: sql<number>`coalesce(sum(cost_usd), 0)` })
      .from(interviews)
      .where(
        and(
          eq(interviews.blogId, blogId),
          gte(interviews.createdAt, startOfMonthMs),
        ),
      );

    const totalMonthlyCostUsd = (result[0]?.totalCost ?? 0) as number;
    if (totalMonthlyCostUsd >= monthlyCostCapUsd) {
      return { ok: false, reason: "cost_cap_exceeded" };
    }
  }

  // 3. Conditional UPDATE — only updates if still in consent state
  const now = Date.now();
  const updated = await db
    .update(interviews)
    .set({
      status: "live",
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(interviews.blogId, blogId),
        eq(interviews.id, id),
        eq(interviews.status, "consent"),
      ),
    )
    .returning({ id: interviews.id });

  if (updated.length === 0) {
    // Another concurrent request already transitioned it
    return { ok: false, reason: "conflict" };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cost aggregation (workspace monthly cost cap)
// ---------------------------------------------------------------------------

/**
 * Sum `costUsd` across all interviews created this calendar month for a blog.
 *
 * Mirrors the running-total read used by the consent-route cost cap. Used by
 * the tool dispatcher to refuse LLM-incurring tools once the workspace's
 * `monthlyCostCapUsd` is reached.
 */
export async function sumMonthlyInterviewCostUsd(
  blogId: string,
  db: DB = getDb(),
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ totalCost: sql<number>`coalesce(sum(cost_usd), 0)` })
    .from(interviews)
    .where(
      and(
        eq(interviews.blogId, blogId),
        gte(interviews.createdAt, startOfMonth.getTime()),
      ),
    );

  return (result[0]?.totalCost ?? 0) as number;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listInterviews(
  blogId: string,
  opts: { startedByUid?: string; limit?: number } = {},
  db: DB = getDb(),
): Promise<InterviewRow[]> {
  const limit = opts.limit ?? 200;

  const conditions = [eq(interviews.blogId, blogId)];
  if (opts.startedByUid) {
    conditions.push(eq(interviews.startedByUid, opts.startedByUid));
  }

  const rows = await db
    .select()
    .from(interviews)
    .where(and(...conditions))
    .orderBy(desc(interviews.createdAt), desc(interviews.id))
    .limit(limit);

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteInterview(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(interviews)
    .where(and(eq(interviews.blogId, blogId), eq(interviews.id, id)))
    .returning({ id: interviews.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Increment responsesCount (atomic)
// ---------------------------------------------------------------------------

export async function incrementResponsesCount(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(interviews)
    .set({
      responsesCount: sql`${interviews.responsesCount} + 1`,
      updatedAt: Date.now(),
    })
    .where(and(eq(interviews.blogId, blogId), eq(interviews.id, id)));
}
