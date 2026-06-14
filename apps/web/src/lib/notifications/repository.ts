import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { notifications } from "@/db/schema/notifications";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:notifications");

type DB = DrizzleD1Database<typeof schema>;

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string;
  blogId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}

type Row = typeof notifications.$inferSelect;

function toRow(row: Row): NotificationRow {
  return {
    id: row.id,
    blogId: row.blogId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    actionUrl: row.actionUrl ?? null,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    read: row.read,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type ListNotificationsOptions = {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

export async function listNotifications(
  blogId: string,
  userId: string,
  options: ListNotificationsOptions = {},
  db: DB = getDb(),
): Promise<NotificationRow[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const conditions = [
    eq(notifications.blogId, blogId),
    eq(notifications.userId, userId),
  ];
  if (options.unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    // id tiebreaker keeps ordering deterministic for same-millisecond rows
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateNotificationInput = {
  userId: string;
  type?: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  blogId: string,
  input: CreateNotificationInput,
  db: DB = getDb(),
): Promise<NotificationRow> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(notifications).values({
    id,
    blogId,
    userId: input.userId,
    type: input.type ?? "info",
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    read: false,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created notification", { id, blogId, userId: input.userId });

  return {
    id,
    blogId,
    userId: input.userId,
    type: input.type ?? "info",
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    metadata: input.metadata ?? null,
    read: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Mark read / unread
// ---------------------------------------------------------------------------

/**
 * Mark specific notifications as read or unread.
 * Scoped by blogId + userId — ignores IDs not owned by this user.
 * Returns the count of rows actually updated.
 */
export async function markNotificationsRead(
  blogId: string,
  userId: string,
  ids: string[],
  read: boolean,
  db: DB = getDb(),
): Promise<number> {
  if (ids.length === 0) return 0;

  const rows = await db
    .update(notifications)
    .set({ read, updatedAt: Date.now() })
    .where(
      and(
        eq(notifications.blogId, blogId),
        eq(notifications.userId, userId),
        inArray(notifications.id, ids),
      ),
    )
    .returning({ id: notifications.id });

  return rows.length;
}

/**
 * Mark ALL notifications for a user as read.
 * Scoped by blogId + userId.
 */
export async function markAllNotificationsRead(
  blogId: string,
  userId: string,
  db: DB = getDb(),
): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ read: true, updatedAt: Date.now() })
    .where(
      and(
        eq(notifications.blogId, blogId),
        eq(notifications.userId, userId),
        eq(notifications.read, false),
      ),
    )
    .returning({ id: notifications.id });

  return rows.length;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete specific notifications.
 * Scoped by blogId + userId — ignores IDs not owned by this user.
 * Returns the count of rows deleted.
 */
export async function deleteNotifications(
  blogId: string,
  userId: string,
  ids: string[],
  db: DB = getDb(),
): Promise<number> {
  if (ids.length === 0) return 0;

  const rows = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.blogId, blogId),
        eq(notifications.userId, userId),
        inArray(notifications.id, ids),
      ),
    )
    .returning({ id: notifications.id });

  log.info("Deleted notifications", { count: rows.length, blogId, userId });

  return rows.length;
}
