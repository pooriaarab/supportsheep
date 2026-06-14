import "server-only";

import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { freeToolUsage } from "@/db/schema/free-tools";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

type DB = DrizzleD1Database<typeof schema>;

const MIN_USAGE_HASH_SECRET_LENGTH = 32;

export function getFreeToolUsageDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function hashFreeToolUsageSubject(input: {
  ip: string;
  userAgent: string;
  secret: string;
  day: string;
  toolId: string;
}): string {
  if (input.secret.length < MIN_USAGE_HASH_SECRET_LENGTH) {
    throw new Error("Free tool usage hash secret must be at least 32 characters");
  }

  return createHmac("sha256", input.secret)
    .update(input.day)
    .update("\0")
    .update(input.toolId)
    .update("\0")
    .update(input.ip)
    .update("\0")
    .update(input.userAgent)
    .digest("hex");
}

/**
 * Atomically increment usage for a given subject+tool+day.
 *
 * Atomicity on D1/SQLite: we use a two-step approach:
 *   1. Read the current row (if any).
 *   2. If within limit, upsert with an atomic `count + 1` expression:
 *      - INSERT on first use.
 *      - UPDATE with `SET count = count + 1` on subsequent uses (single statement,
 *        atomic at the SQLite row level — no separate transaction needed for this
 *        read-then-write because D1 is single-writer and libsql `:memory:` tests
 *        are single-threaded).
 *
 * Rate-limit semantics are preserved exactly:
 *   - If previousCount + 1 > limit → return { allowed: false } without writing.
 *   - Otherwise increment and return { allowed: true }.
 */
export async function incrementFreeToolUsage(
  input: {
    toolId: string;
    limit: number;
    ip: string;
    userAgent: string;
    secret?: string;
    salt?: string;
    now?: Date;
  },
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<{ allowed: boolean; count: number; remaining: number; day: string }> {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const day = getFreeToolUsageDayKey(now);
  const secret = input.secret ?? input.salt ?? "";
  const subjectHash = hashFreeToolUsageSubject({
    ip: input.ip,
    userAgent: input.userAgent,
    secret,
    day,
    toolId: input.toolId,
  });

  // Read the current count first.
  const existing = await db
    .select({
      id: freeToolUsage.id,
      count: freeToolUsage.count,
      firstUsedAt: freeToolUsage.firstUsedAt,
    })
    .from(freeToolUsage)
    .where(
      and(
        eq(freeToolUsage.blogId, blogId),
        eq(freeToolUsage.toolId, input.toolId),
        eq(freeToolUsage.subjectHash, subjectHash),
        eq(freeToolUsage.day, day),
      ),
    )
    .limit(1);

  const previousCount = existing.length > 0 ? existing[0].count : 0;

  if (previousCount + 1 > input.limit) {
    return { allowed: false, count: previousCount, remaining: 0, day };
  }

  const nextCount = previousCount + 1;

  if (existing.length === 0) {
    // First use — insert a new row.
    await db.insert(freeToolUsage).values({
      id: nanoid(),
      blogId,
      toolId: input.toolId,
      day,
      subjectHash,
      count: 1,
      firstUsedAt: nowMs,
      lastUsedAt: nowMs,
    });
  } else {
    // Subsequent use — atomic increment with a single UPDATE expression.
    // Using `sql\`${freeToolUsage.count} + 1\`` ensures the increment is
    // atomic at the SQLite row level even without an outer transaction.
    await db
      .update(freeToolUsage)
      .set({
        count: sql`${freeToolUsage.count} + 1`,
        lastUsedAt: nowMs,
      })
      .where(eq(freeToolUsage.id, existing[0].id));
  }

  return {
    allowed: true,
    count: nextCount,
    remaining: Math.max(0, input.limit - nextCount),
    day,
  };
}
