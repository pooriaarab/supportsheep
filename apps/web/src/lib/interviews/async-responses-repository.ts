import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { asyncResponses } from "@/db/schema/interviews";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:interviews:async-responses-repository");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof asyncResponses.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface AsyncResponseRow {
  id: string;
  blogId: string;
  interviewId: string;
  questionId: string;
  audioStoragePath: string;
  transcript: string;
  createdAt: number;
}

function toRow(row: Row): AsyncResponseRow {
  return {
    id: row.id,
    blogId: row.blogId,
    interviewId: row.interviewId,
    questionId: row.questionId,
    audioStoragePath: row.audioStoragePath,
    transcript: row.transcript,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Upsert (insert or replace on re-submit)
// ---------------------------------------------------------------------------

export interface UpsertAsyncResponseInput {
  questionId: string;
  audioStoragePath: string;
  transcript: string;
}

/**
 * Insert or replace the async response for a (interview, question) pair.
 *
 * The UNIQUE index on (interview_id, question_id) means a guest re-answering
 * a question overwrites the previous transcript and storage path — preserving
 * the Firestore `.set()` upsert semantics. `onConflictDoUpdate` targets the
 * named unique index directly so both the first insert and every subsequent
 * re-submit land as a single round-trip.
 */
export async function upsertAsyncResponse(
  blogId: string,
  interviewId: string,
  input: UpsertAsyncResponseInput,
  db: DB = getDb(),
): Promise<AsyncResponseRow> {
  const now = Date.now();
  const id = nanoid();

  await db
    .insert(asyncResponses)
    .values({
      id,
      blogId,
      interviewId,
      questionId: input.questionId,
      audioStoragePath: input.audioStoragePath,
      transcript: input.transcript,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [asyncResponses.interviewId, asyncResponses.questionId],
      set: {
        audioStoragePath: input.audioStoragePath,
        transcript: input.transcript,
        createdAt: now,
      },
    });

  log.info("upserted async response", { blogId, interviewId, questionId: input.questionId });

  // Fetch the canonical row so callers always get a fully-hydrated result
  // regardless of whether this was an insert or an update.
  const row = await getAsyncResponse(blogId, interviewId, input.questionId, db);
  if (!row) throw new Error(`Failed to fetch async response after upsert: ${input.questionId}`);
  return row;
}

// ---------------------------------------------------------------------------
// Get single response
// ---------------------------------------------------------------------------

export async function getAsyncResponse(
  blogId: string,
  interviewId: string,
  questionId: string,
  db: DB = getDb(),
): Promise<AsyncResponseRow | null> {
  const rows = await db
    .select()
    .from(asyncResponses)
    .where(
      and(
        eq(asyncResponses.blogId, blogId),
        eq(asyncResponses.interviewId, interviewId),
        eq(asyncResponses.questionId, questionId),
      ),
    )
    .limit(1);
  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// List (used by stitcher)
// ---------------------------------------------------------------------------

/**
 * Return all async responses for an interview ordered by `created_at` asc
 * then `question_id` asc for deterministic ordering when two responses share
 * the same millisecond timestamp (e.g. seeded in tests).
 */
export async function listAsyncResponses(
  blogId: string,
  interviewId: string,
  db: DB = getDb(),
): Promise<AsyncResponseRow[]> {
  const rows = await db
    .select()
    .from(asyncResponses)
    .where(
      and(
        eq(asyncResponses.blogId, blogId),
        eq(asyncResponses.interviewId, interviewId),
      ),
    )
    .orderBy(asc(asyncResponses.createdAt), asc(asyncResponses.questionId));
  return rows.map(toRow);
}
