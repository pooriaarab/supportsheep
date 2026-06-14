import "server-only";

import { count, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { domainWaitlist } from "@/db/schema/domain-waitlist";

type DB = DrizzleD1Database<typeof schema>;

export interface DomainWaitlistEntry {
  blogId: string;
  userId: string;
  email: string;
}

/**
 * Add a blog to the custom-domain waitlist. Idempotent: a second join for the
 * same blog is a no-op (the unique index on `blog_id` is the real guard).
 */
export async function joinDomainWaitlist(
  entry: DomainWaitlistEntry,
  db: DB = getDb(),
): Promise<void> {
  await db
    .insert(domainWaitlist)
    .values({
      blogId: entry.blogId,
      userId: entry.userId,
      email: entry.email,
      createdAt: Date.now(),
    })
    .onConflictDoNothing({ target: domainWaitlist.blogId });
}

/** True when this blog has already joined the custom-domain waitlist. */
export async function isBlogOnWaitlist(
  blogId: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .select({ blogId: domainWaitlist.blogId })
    .from(domainWaitlist)
    .where(eq(domainWaitlist.blogId, blogId))
    .limit(1);
  return rows.length > 0;
}

/** Total number of blogs on the custom-domain waitlist. */
export async function countDomainWaitlist(db: DB = getDb()): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(domainWaitlist);
  return rows[0]?.value ?? 0;
}
