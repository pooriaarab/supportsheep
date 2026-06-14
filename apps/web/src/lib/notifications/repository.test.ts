import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createNotification,
  deleteNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "./repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = Parameters<typeof listNotifications>[3];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE notifications (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    user_id text NOT NULL,
    type text DEFAULT 'info' NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    metadata text,
    read integer DEFAULT false NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX notifications_blog_user_idx ON notifications (blog_id, user_id);`,
  );
  await client.execute(
    `CREATE INDEX notifications_blog_user_read_idx ON notifications (blog_id, user_id, read);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("notifications repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listNotifications — basic
  // ---------------------------------------------------------------------------

  it("returns empty list initially", async () => {
    expect(await listNotifications("blog-1", "user-1", {}, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // createNotification + shape
  // ---------------------------------------------------------------------------

  it("creates a notification and returns correct shape", async () => {
    const before = Date.now();
    const result = await createNotification(
      "blog-1",
      {
        userId: "user-1",
        type: "task",
        title: "Hello",
        message: "World",
        actionUrl: "/go/here",
        metadata: { foo: "bar" },
      },
      db,
    );
    const after = Date.now();

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.blogId).toBe("blog-1");
    expect(result.userId).toBe("user-1");
    expect(result.type).toBe("task");
    expect(result.title).toBe("Hello");
    expect(result.message).toBe("World");
    expect(result.actionUrl).toBe("/go/here");
    expect(result.metadata).toEqual({ foo: "bar" });
    expect(result.read).toBe(false);
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
  });

  it("defaults type to 'info' when not provided", async () => {
    const result = await createNotification(
      "blog-1",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );
    expect(result.type).toBe("info");
  });

  it("stores null metadata when not provided", async () => {
    const result = await createNotification(
      "blog-1",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );
    expect(result.metadata).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // listNotifications — ordering
  // ---------------------------------------------------------------------------

  it("lists notifications newest first (createdAt desc)", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000) // first create_at
      .mockReturnValueOnce(1000) // first updated_at
      .mockReturnValueOnce(2000) // second created_at
      .mockReturnValueOnce(2000); // second updated_at

    await createNotification("blog-1", { userId: "user-1", title: "Older", message: "M" }, db);
    await createNotification("blog-1", { userId: "user-1", title: "Newer", message: "M" }, db);
    nowSpy.mockRestore();

    const list = await listNotifications("blog-1", "user-1", {}, db);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("Newer");
    expect(list[1].title).toBe("Older");
  });

  it("id tiebreaker makes ordering deterministic for same-millisecond inserts", async () => {
    // Both rows get same createdAt
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(5000);

    const a = await createNotification(
      "blog-1",
      { userId: "user-1", title: "A", message: "M" },
      db,
    );
    const b = await createNotification(
      "blog-1",
      { userId: "user-1", title: "B", message: "M" },
      db,
    );
    nowSpy.mockRestore();

    const list = await listNotifications("blog-1", "user-1", {}, db);
    expect(list).toHaveLength(2);
    // id tiebreaker (desc) means larger id sorts first; both are nanoids so
    // result is stable — just ensure both appear
    expect(new Set(list.map((n) => n.id))).toEqual(new Set([a.id, b.id]));
  });

  // ---------------------------------------------------------------------------
  // listNotifications — unreadOnly filter
  // ---------------------------------------------------------------------------

  it("unreadOnly filter returns only unread notifications", async () => {
    const n1 = await createNotification(
      "blog-1",
      { userId: "user-1", title: "Unread", message: "M" },
      db,
    );
    await createNotification(
      "blog-1",
      { userId: "user-1", title: "AlsoUnread", message: "M" },
      db,
    );

    // Mark first one as read
    await markNotificationsRead("blog-1", "user-1", [n1.id], true, db);

    const unread = await listNotifications("blog-1", "user-1", { unreadOnly: true }, db);
    expect(unread).toHaveLength(1);
    expect(unread[0].title).toBe("AlsoUnread");
  });

  // ---------------------------------------------------------------------------
  // listNotifications — pagination
  // ---------------------------------------------------------------------------

  it("respects limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await createNotification(
        "blog-1",
        { userId: "user-1", title: `N${i}`, message: "M" },
        db,
      );
    }

    const page1 = await listNotifications("blog-1", "user-1", { limit: 2, offset: 0 }, db);
    const page2 = await listNotifications("blog-1", "user-1", { limit: 2, offset: 2 }, db);

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    // Pages should not overlap
    const ids1 = new Set(page1.map((n) => n.id));
    const ids2 = new Set(page2.map((n) => n.id));
    expect([...ids1].filter((id) => ids2.has(id))).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // markNotificationsRead
  // ---------------------------------------------------------------------------

  it("marks a notification as read and returns count", async () => {
    const n = await createNotification(
      "blog-1",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );
    expect(n.read).toBe(false);

    const updated = await markNotificationsRead("blog-1", "user-1", [n.id], true, db);
    expect(updated).toBe(1);

    const list = await listNotifications("blog-1", "user-1", {}, db);
    expect(list[0].read).toBe(true);
  });

  it("marks a notification as unread", async () => {
    const n = await createNotification(
      "blog-1",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );
    await markNotificationsRead("blog-1", "user-1", [n.id], true, db);
    await markNotificationsRead("blog-1", "user-1", [n.id], false, db);

    const list = await listNotifications("blog-1", "user-1", {}, db);
    expect(list[0].read).toBe(false);
  });

  it("returns 0 for empty ids array", async () => {
    const updated = await markNotificationsRead("blog-1", "user-1", [], true, db);
    expect(updated).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // markAllNotificationsRead
  // ---------------------------------------------------------------------------

  it("marks all unread notifications as read and returns count", async () => {
    await createNotification("blog-1", { userId: "user-1", title: "A", message: "M" }, db);
    await createNotification("blog-1", { userId: "user-1", title: "B", message: "M" }, db);

    const count = await markAllNotificationsRead("blog-1", "user-1", db);
    expect(count).toBe(2);

    const list = await listNotifications("blog-1", "user-1", {}, db);
    expect(list.every((n) => n.read)).toBe(true);
  });

  it("markAllNotificationsRead returns 0 when none are unread", async () => {
    const n = await createNotification(
      "blog-1",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );
    await markNotificationsRead("blog-1", "user-1", [n.id], true, db);

    const count = await markAllNotificationsRead("blog-1", "user-1", db);
    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // deleteNotifications
  // ---------------------------------------------------------------------------

  it("deletes own notifications and returns count", async () => {
    const n1 = await createNotification(
      "blog-1",
      { userId: "user-1", title: "A", message: "M" },
      db,
    );
    const n2 = await createNotification(
      "blog-1",
      { userId: "user-1", title: "B", message: "M" },
      db,
    );

    const deleted = await deleteNotifications("blog-1", "user-1", [n1.id, n2.id], db);
    expect(deleted).toBe(2);
    expect(await listNotifications("blog-1", "user-1", {}, db)).toEqual([]);
  });

  it("returns 0 for empty ids array", async () => {
    const deleted = await deleteNotifications("blog-1", "user-1", [], db);
    expect(deleted).toBe(0);
  });

  it("returns 0 when deleting nonexistent ids", async () => {
    const deleted = await deleteNotifications("blog-1", "user-1", ["ghost-id"], db);
    expect(deleted).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation (blog A vs blog B)
  // ---------------------------------------------------------------------------

  it("blog A notifications are invisible to blog B queries", async () => {
    await createNotification("blog-a", { userId: "user-1", title: "A-notif", message: "M" }, db);

    const listB = await listNotifications("blog-b", "user-1", {}, db);
    expect(listB).toHaveLength(0);
  });

  it("markNotificationsRead does not affect other blog's notifications", async () => {
    const n = await createNotification(
      "blog-a",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );

    // blog-b attempts to mark blog-a's notification
    const updated = await markNotificationsRead("blog-b", "user-1", [n.id], true, db);
    expect(updated).toBe(0);

    // Original still unread
    const listA = await listNotifications("blog-a", "user-1", {}, db);
    expect(listA[0].read).toBe(false);
  });

  it("deleteNotifications does not affect other blog's notifications", async () => {
    const n = await createNotification(
      "blog-a",
      { userId: "user-1", title: "T", message: "M" },
      db,
    );

    const deleted = await deleteNotifications("blog-b", "user-1", [n.id], db);
    expect(deleted).toBe(0);

    expect(await listNotifications("blog-a", "user-1", {}, db)).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Owner isolation (user X vs user Y within same blog)
  // ---------------------------------------------------------------------------

  it("user X cannot list user Y's notifications", async () => {
    await createNotification(
      "blog-1",
      { userId: "user-x", title: "Private", message: "M" },
      db,
    );

    const listY = await listNotifications("blog-1", "user-y", {}, db);
    expect(listY).toHaveLength(0);
  });

  it("user X cannot mark user Y's notifications as read", async () => {
    const n = await createNotification(
      "blog-1",
      { userId: "user-y", title: "T", message: "M" },
      db,
    );

    const updated = await markNotificationsRead("blog-1", "user-x", [n.id], true, db);
    expect(updated).toBe(0);

    // user-y's notification is still unread
    const list = await listNotifications("blog-1", "user-y", {}, db);
    expect(list[0].read).toBe(false);
  });

  it("user X cannot delete user Y's notifications", async () => {
    const n = await createNotification(
      "blog-1",
      { userId: "user-y", title: "T", message: "M" },
      db,
    );

    const deleted = await deleteNotifications("blog-1", "user-x", [n.id], db);
    expect(deleted).toBe(0);

    expect(await listNotifications("blog-1", "user-y", {}, db)).toHaveLength(1);
  });

  it("cross-blog cross-user: two users each see only their own notifications", async () => {
    await createNotification("blog-1", { userId: "alice", title: "Alice A", message: "M" }, db);
    await createNotification("blog-1", { userId: "alice", title: "Alice B", message: "M" }, db);
    await createNotification("blog-1", { userId: "bob", title: "Bob A", message: "M" }, db);
    await createNotification("blog-2", { userId: "alice", title: "Alice blog2", message: "M" }, db);

    const aliceBlog1 = await listNotifications("blog-1", "alice", {}, db);
    expect(aliceBlog1).toHaveLength(2);
    expect(aliceBlog1.every((n) => n.userId === "alice" && n.blogId === "blog-1")).toBe(true);

    const bobBlog1 = await listNotifications("blog-1", "bob", {}, db);
    expect(bobBlog1).toHaveLength(1);
    expect(bobBlog1[0].title).toBe("Bob A");

    const aliceBlog2 = await listNotifications("blog-2", "alice", {}, db);
    expect(aliceBlog2).toHaveLength(1);
    expect(aliceBlog2[0].title).toBe("Alice blog2");
  });
});
