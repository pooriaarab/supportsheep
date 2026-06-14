import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  addMessage,
  countMessages,
  createThread,
  deleteThread,
  getFirstUserMessage,
  getThread,
  listMessages,
  listRecentMessages,
  listThreads,
  touchThread,
} from "./chat-repository";

type TestDb = NonNullable<Parameters<typeof listThreads>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE ai_chat_threads (
      id text PRIMARY KEY NOT NULL,
      blog_id text NOT NULL,
      user_id text NOT NULL,
      title text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
  `);
  await client.execute(
    `CREATE INDEX ai_chat_threads_blog_user_idx ON ai_chat_threads (blog_id, user_id);`,
  );
  await client.execute(`
    CREATE TABLE ai_chat_messages (
      id text PRIMARY KEY NOT NULL,
      blog_id text NOT NULL,
      thread_id text NOT NULL,
      user_id text NOT NULL,
      role text NOT NULL,
      content text NOT NULL,
      created_at integer NOT NULL
    );
  `);
  await client.execute(
    `CREATE INDEX ai_chat_messages_blog_thread_idx ON ai_chat_messages (blog_id, thread_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("chat-repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listThreads + createThread
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listThreads("blog-1", "user-1", db)).toEqual([]);
  });

  it("creates a thread and finds it", async () => {
    const thread = await createThread("blog-1", "user-1", { title: "Hello" }, db);
    expect(thread.id).toBeTruthy();
    expect(thread.title).toBe("Hello");
    expect(thread.blogId).toBe("blog-1");
    expect(thread.userId).toBe("user-1");
    expect(typeof thread.createdAt).toBe("number");
    expect(typeof thread.updatedAt).toBe("number");
  });

  it("honors a caller-supplied id (route get-or-create contract)", async () => {
    // Mirrors the POST /ai/chat path: the client owns the threadId, the route
    // creates the thread row under that exact id, then stores messages with the
    // same threadId. getThread + listMessages with the client id must succeed.
    const clientId = "client-thread-abc";
    const created = await createThread(
      "blog-1",
      "user-1",
      { id: clientId, title: "Hello world" },
      db,
    );
    expect(created.id).toBe(clientId);

    // Thread row is retrievable by the client id...
    const found = await getThread("blog-1", "user-1", clientId, db);
    expect(found?.id).toBe(clientId);

    // ...and messages stored under that same id are listed back.
    await addMessage("blog-1", { threadId: clientId, userId: "user-1", role: "user", content: "Hi" }, db);
    const messages = await listMessages("blog-1", clientId, db);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hi");
  });

  it("defaults to a generated id when none supplied", async () => {
    const created = await createThread("blog-1", "user-1", { title: "T" }, db);
    expect(created.id).toBeTruthy();
    expect(created.id.length).toBeGreaterThan(0);
  });

  it("lists threads ordered by updatedAt desc with id tiebreaker", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);
    await createThread("blog-1", "user-1", { title: "Old" }, db);
    await createThread("blog-1", "user-1", { title: "New" }, db);
    nowSpy.mockRestore();

    const threads = await listThreads("blog-1", "user-1", db);
    expect(threads[0].title).toBe("New");
    expect(threads[1].title).toBe("Old");
  });

  // ---------------------------------------------------------------------------
  // getThread
  // ---------------------------------------------------------------------------

  it("getThread returns null for non-existent thread", async () => {
    expect(await getThread("blog-1", "user-1", "no-such-id", db)).toBeNull();
  });

  it("getThread returns the thread when found", async () => {
    const created = await createThread("blog-1", "user-1", { title: "T" }, db);
    const found = await getThread("blog-1", "user-1", created.id, db);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe("T");
  });

  // ---------------------------------------------------------------------------
  // touchThread
  // ---------------------------------------------------------------------------

  it("touchThread bumps updatedAt", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const thread = await createThread("blog-1", "user-1", {}, db);
    nowSpy.mockReturnValue(9999);
    await touchThread("blog-1", "user-1", thread.id, db);
    nowSpy.mockRestore();

    const found = await getThread("blog-1", "user-1", thread.id, db);
    expect(found?.updatedAt).toBe(9999);
  });

  it("touchThread is scoped by userId — cannot bump another user's thread", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const thread = await createThread("blog-1", "user-y", {}, db);
    nowSpy.mockReturnValue(9999);
    await touchThread("blog-1", "user-x", thread.id, db);
    nowSpy.mockRestore();

    const found = await getThread("blog-1", "user-y", thread.id, db);
    expect(found?.updatedAt).toBe(1000); // unchanged
  });

  // ---------------------------------------------------------------------------
  // addMessage + listMessages
  // ---------------------------------------------------------------------------

  it("addMessage stores a message", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    const msg = await addMessage(
      "blog-1",
      { threadId: thread.id, userId: "user-1", role: "user", content: "Hi" },
      db,
    );
    expect(msg.id).toBeTruthy();
    expect(msg.content).toBe("Hi");
    expect(msg.role).toBe("user");
  });

  it("listMessages returns messages in createdAt asc order", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    // Each addMessage reads Date.now() exactly once; give the two messages
    // DISTINCT, increasing timestamps so ordering is deterministic (not left
    // to the random nanoid tiebreaker).
    let nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "First" }, db);
    nowSpy.mockRestore();
    nowSpy = vi.spyOn(Date, "now").mockReturnValue(2000);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "assistant", content: "Second" }, db);
    nowSpy.mockRestore();

    const messages = await listMessages("blog-1", thread.id, db);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Second");
  });

  it("listMessages uses id tiebreaker for same-millisecond rows", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    // Identical created_at; insert explicit ids to assert asc(id) ordering.
    await db.insert(schema.aiChatMessages).values([
      { id: "zzz", blogId: "blog-1", threadId: thread.id, userId: "user-1", role: "user", content: "Z", createdAt: 1000 },
      { id: "aaa", blogId: "blog-1", threadId: thread.id, userId: "user-1", role: "user", content: "A", createdAt: 1000 },
    ]);
    const ids = (await listMessages("blog-1", thread.id, db)).map((m) => m.id);
    expect(ids).toEqual(["aaa", "zzz"]);
  });

  // ---------------------------------------------------------------------------
  // listRecentMessages
  // ---------------------------------------------------------------------------

  it("listRecentMessages returns last N messages in chronological order", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    for (let i = 1; i <= 5; i++) {
      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(i * 1000);
      await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: `msg${i}` }, db);
      nowSpy.mockRestore();
    }

    const recent = await listRecentMessages("blog-1", thread.id, 3, db);
    expect(recent).toHaveLength(3);
    // Should be chronological order (oldest first among the 3 most recent)
    expect(recent[0].content).toBe("msg3");
    expect(recent[1].content).toBe("msg4");
    expect(recent[2].content).toBe("msg5");
  });

  // ---------------------------------------------------------------------------
  // countMessages
  // ---------------------------------------------------------------------------

  it("countMessages returns 0 for empty thread", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    expect(await countMessages("blog-1", thread.id, db)).toBe(0);
  });

  it("countMessages counts correctly", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "a" }, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "assistant", content: "b" }, db);
    expect(await countMessages("blog-1", thread.id, db)).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // getFirstUserMessage
  // ---------------------------------------------------------------------------

  it("getFirstUserMessage returns null for empty thread", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    expect(await getFirstUserMessage("blog-1", thread.id, db)).toBeNull();
  });

  it("getFirstUserMessage returns the first user message", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "First user msg" }, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "Second user msg" }, db);
    nowSpy.mockRestore();

    const first = await getFirstUserMessage("blog-1", thread.id, db);
    expect(first?.content).toBe("First user msg");
  });

  it("getFirstUserMessage skips assistant messages", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(500)
      .mockReturnValueOnce(1000);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "assistant", content: "Assistant first" }, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "User second" }, db);
    nowSpy.mockRestore();

    const first = await getFirstUserMessage("blog-1", thread.id, db);
    expect(first?.content).toBe("User second");
  });

  // ---------------------------------------------------------------------------
  // deleteThread
  // ---------------------------------------------------------------------------

  it("deleteThread returns false for non-existent thread", async () => {
    expect(await deleteThread("blog-1", "user-1", "no-such-id", db)).toBe(false);
  });

  it("deleteThread removes thread and all its messages atomically", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "user", content: "msg1" }, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-1", role: "assistant", content: "msg2" }, db);

    expect(await deleteThread("blog-1", "user-1", thread.id, db)).toBe(true);

    // Thread is gone
    expect(await getThread("blog-1", "user-1", thread.id, db)).toBeNull();
    // Messages are gone
    expect(await listMessages("blog-1", thread.id, db)).toHaveLength(0);
    expect(await countMessages("blog-1", thread.id, db)).toBe(0);
  });

  it("deleteThread is idempotent — second delete returns false", async () => {
    const thread = await createThread("blog-1", "user-1", {}, db);
    expect(await deleteThread("blog-1", "user-1", thread.id, db)).toBe(true);
    expect(await deleteThread("blog-1", "user-1", thread.id, db)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  it("blog-a threads are invisible to blog-b", async () => {
    await createThread("blog-a", "user-1", { title: "Private" }, db);
    expect(await listThreads("blog-b", "user-1", db)).toHaveLength(0);
  });

  it("blog-a getThread not accessible from blog-b", async () => {
    const thread = await createThread("blog-a", "user-1", {}, db);
    expect(await getThread("blog-b", "user-1", thread.id, db)).toBeNull();
  });

  it("blog-a messages invisible to blog-b listMessages", async () => {
    const thread = await createThread("blog-a", "user-1", {}, db);
    await addMessage("blog-a", { threadId: thread.id, userId: "user-1", role: "user", content: "secret" }, db);
    expect(await listMessages("blog-b", thread.id, db)).toHaveLength(0);
  });

  it("blog-a thread cannot be deleted by blog-b", async () => {
    const thread = await createThread("blog-a", "user-1", {}, db);
    expect(await deleteThread("blog-b", "user-1", thread.id, db)).toBe(false);
    // Still exists in blog-a
    expect(await getThread("blog-a", "user-1", thread.id, db)).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Owner isolation
  // ---------------------------------------------------------------------------

  it("user-x cannot see user-y's threads via listThreads", async () => {
    await createThread("blog-1", "user-x", { title: "X's thread" }, db);
    expect(await listThreads("blog-1", "user-y", db)).toHaveLength(0);
  });

  it("user-x cannot getThread owned by user-y", async () => {
    const thread = await createThread("blog-1", "user-y", {}, db);
    expect(await getThread("blog-1", "user-x", thread.id, db)).toBeNull();
  });

  it("user-x cannot delete user-y's thread", async () => {
    const thread = await createThread("blog-1", "user-y", {}, db);
    await addMessage("blog-1", { threadId: thread.id, userId: "user-y", role: "user", content: "y's msg" }, db);

    expect(await deleteThread("blog-1", "user-x", thread.id, db)).toBe(false);
    // Thread still there for user-y
    expect(await getThread("blog-1", "user-y", thread.id, db)).not.toBeNull();
  });
});
