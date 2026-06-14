import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { aiChatMessages, aiChatThreads } from "@/db/schema/ai-chat";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:ai:chat-repository");

type DB = DrizzleD1Database<typeof schema>;

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export interface ThreadRow {
  id: string;
  blogId: string;
  userId: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: string;
  blogId: string;
  threadId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Thread operations
// ---------------------------------------------------------------------------

export async function getThread(
  blogId: string,
  userId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<ThreadRow | null> {
  const rows = await db
    .select()
    .from(aiChatThreads)
    .where(
      and(
        eq(aiChatThreads.blogId, blogId),
        eq(aiChatThreads.userId, userId),
        eq(aiChatThreads.id, threadId),
      ),
    )
    .limit(1);
  return rows.length > 0 ? (rows[0] as ThreadRow) : null;
}

export async function listThreads(
  blogId: string,
  userId: string,
  db: DB = getDb(),
): Promise<ThreadRow[]> {
  const rows = await db
    .select()
    .from(aiChatThreads)
    .where(
      and(
        eq(aiChatThreads.blogId, blogId),
        eq(aiChatThreads.userId, userId),
      ),
    )
    // id tiebreaker keeps ordering deterministic for same-millisecond rows
    .orderBy(desc(aiChatThreads.updatedAt), desc(aiChatThreads.id))
    .limit(50);
  return rows as ThreadRow[];
}

export type CreateThreadInput = {
  /** Caller-supplied thread id (e.g. the client's localStorage id). Defaults to nanoid(). */
  id?: string;
  title?: string;
};

export async function createThread(
  blogId: string,
  userId: string,
  input: CreateThreadInput,
  db: DB = getDb(),
): Promise<ThreadRow> {
  const id = input.id ?? nanoid();
  const now = Date.now();
  await db.insert(aiChatThreads).values({
    id,
    blogId,
    userId,
    title: input.title ?? null,
    createdAt: now,
    updatedAt: now,
  });
  log.info("Created thread", { id, blogId });
  return { id, blogId, userId, title: input.title ?? null, createdAt: now, updatedAt: now };
}

export async function touchThread(
  blogId: string,
  userId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(aiChatThreads)
    .set({ updatedAt: Date.now() })
    .where(
      and(
        eq(aiChatThreads.blogId, blogId),
        eq(aiChatThreads.userId, userId),
        eq(aiChatThreads.id, threadId),
      ),
    );
}

/**
 * Delete a thread and all its messages atomically.
 * Scoped by blogId + userId — returns false when not found.
 */
export async function deleteThread(
  blogId: string,
  userId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<boolean> {
  const thread = await getThread(blogId, userId, threadId, db);
  if (!thread) return false;

  await db.batch([
    db
      .delete(aiChatMessages)
      .where(
        and(
          eq(aiChatMessages.blogId, blogId),
          eq(aiChatMessages.threadId, threadId),
        ),
      ),
    db
      .delete(aiChatThreads)
      .where(
        and(
          eq(aiChatThreads.blogId, blogId),
          eq(aiChatThreads.userId, userId),
          eq(aiChatThreads.id, threadId),
        ),
      ),
  ]);

  log.info("Deleted thread", { threadId, blogId });
  return true;
}

// ---------------------------------------------------------------------------
// Message operations
// ---------------------------------------------------------------------------

export async function listMessages(
  blogId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<MessageRow[]> {
  const rows = await db
    .select()
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.blogId, blogId),
        eq(aiChatMessages.threadId, threadId),
      ),
    )
    // id tiebreaker for determinism
    .orderBy(asc(aiChatMessages.createdAt), asc(aiChatMessages.id));
  return rows as MessageRow[];
}

export async function listRecentMessages(
  blogId: string,
  threadId: string,
  limit: number,
  db: DB = getDb(),
): Promise<MessageRow[]> {
  // Fetch the newest `limit` rows desc, then reverse for chronological order
  const rows = await db
    .select()
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.blogId, blogId),
        eq(aiChatMessages.threadId, threadId),
      ),
    )
    .orderBy(desc(aiChatMessages.createdAt), desc(aiChatMessages.id))
    .limit(limit);
  return (rows as MessageRow[]).reverse();
}

export type AddMessageInput = {
  threadId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
};

export async function addMessage(
  blogId: string,
  input: AddMessageInput,
  db: DB = getDb(),
): Promise<MessageRow> {
  const id = nanoid();
  const now = Date.now();
  await db.insert(aiChatMessages).values({
    id,
    blogId,
    threadId: input.threadId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    createdAt: now,
  });
  return {
    id,
    blogId,
    threadId: input.threadId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    createdAt: now,
  };
}

export async function countMessages(
  blogId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.blogId, blogId),
        eq(aiChatMessages.threadId, threadId),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getFirstUserMessage(
  blogId: string,
  threadId: string,
  db: DB = getDb(),
): Promise<MessageRow | null> {
  const rows = await db
    .select()
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.blogId, blogId),
        eq(aiChatMessages.threadId, threadId),
        eq(aiChatMessages.role, "user"),
      ),
    )
    .orderBy(asc(aiChatMessages.createdAt), asc(aiChatMessages.id))
    .limit(1);
  return rows.length > 0 ? (rows[0] as MessageRow) : null;
}
