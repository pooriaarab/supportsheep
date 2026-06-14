import "server-only";

import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { interviewSessionLocks } from "@/db/schema/interviews";

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof interviewSessionLocks.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface SessionLockRow {
  interviewId: string;
  blogId: string;
  heartbeatId: string;
  lastBeatAt: number; // epoch-ms
}

function toRow(row: Row): SessionLockRow {
  return {
    interviewId: row.interviewId,
    blogId: row.blogId,
    heartbeatId: row.heartbeatId,
    lastBeatAt: row.lastBeatAt,
  };
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getSessionLock(
  blogId: string,
  interviewId: string,
  db: DB = getDb(),
): Promise<SessionLockRow | null> {
  const rows = await db
    .select()
    .from(interviewSessionLocks)
    .where(
      and(
        eq(interviewSessionLocks.blogId, blogId),
        eq(interviewSessionLocks.interviewId, interviewId),
      ),
    )
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Upsert heartbeat
// D1 supports INSERT OR REPLACE which atomically overwrites by PK.
// ---------------------------------------------------------------------------

export type UpsertHeartbeatResult =
  | { status: "acquired" }
  | { status: "refreshed" }
  | { status: "acquired"; previousHolder: string; wasStale: boolean }
  | { status: "conflict"; currentHolder: string; lastBeatAt: number };

export const STALE_LOCK_THRESHOLD_MS = 10_000;

function isStale(lastBeatAt: number): boolean {
  return Date.now() - lastBeatAt > STALE_LOCK_THRESHOLD_MS;
}

/**
 * Upsert a heartbeat for the given interview.
 *
 * Semantics mirror the Firestore session-lock transaction:
 *  - No existing lock → acquire.
 *  - Same heartbeatId → refresh.
 *  - Different holder, stale or takeover=true → acquire (replacing previous holder).
 *  - Different holder, fresh, no takeover → conflict.
 */
export async function upsertHeartbeat(
  blogId: string,
  interviewId: string,
  heartbeatId: string,
  takeover: boolean,
  db: DB = getDb(),
): Promise<UpsertHeartbeatResult> {
  const existing = await getSessionLock(blogId, interviewId, db);

  if (!existing) {
    await db.insert(interviewSessionLocks).values({
      interviewId,
      blogId,
      heartbeatId,
      lastBeatAt: Date.now(),
    });
    return { status: "acquired" };
  }

  if (existing.heartbeatId === heartbeatId) {
    // Refresh own lock
    await db
      .update(interviewSessionLocks)
      .set({ lastBeatAt: Date.now() })
      .where(
        and(
          eq(interviewSessionLocks.blogId, blogId),
          eq(interviewSessionLocks.interviewId, interviewId),
        ),
      );
    return { status: "refreshed" };
  }

  const stale = isStale(existing.lastBeatAt);
  if (stale || takeover) {
    // Take over by overwriting via INSERT OR REPLACE (SQLite upsert)
    await db
      .insert(interviewSessionLocks)
      .values({
        interviewId,
        blogId,
        heartbeatId,
        lastBeatAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: interviewSessionLocks.interviewId,
        set: { heartbeatId, lastBeatAt: Date.now(), blogId },
      });
    return {
      status: "acquired",
      previousHolder: existing.heartbeatId,
      wasStale: stale,
    };
  }

  return {
    status: "conflict",
    currentHolder: existing.heartbeatId,
    lastBeatAt: existing.lastBeatAt,
  };
}

// ---------------------------------------------------------------------------
// Delete (release lock)
// ---------------------------------------------------------------------------

/**
 * Delete the session lock for the given interview only if the caller
 * is the current holder.
 */
export async function deleteSessionLock(
  blogId: string,
  interviewId: string,
  heartbeatId: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(interviewSessionLocks)
    .where(
      and(
        eq(interviewSessionLocks.blogId, blogId),
        eq(interviewSessionLocks.interviewId, interviewId),
        eq(interviewSessionLocks.heartbeatId, heartbeatId),
      ),
    )
    .returning({ interviewId: interviewSessionLocks.interviewId });

  return rows.length > 0;
}

/**
 * Unconditionally release the session lock for an interview.
 *
 * Used by `/end` which is the canonical "this tab is done" signal and must
 * release the lock regardless of which heartbeat client holds it. Returns
 * `true` if a lock existed and was deleted, `false` if there was nothing to
 * release.
 */
export async function releaseSessionLock(
  interviewId: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(interviewSessionLocks)
    .where(eq(interviewSessionLocks.interviewId, interviewId))
    .returning({ interviewId: interviewSessionLocks.interviewId });

  return rows.length > 0;
}
