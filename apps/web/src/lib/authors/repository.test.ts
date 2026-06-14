import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createAuthor,
  deleteAuthor,
  ensurePlaceholderAuthor,
  getAuthor,
  listAuthors,
  updateAuthor,
} from "./repository";

// Real in-memory SQLite (libsql) so the drizzle queries actually run (async, like D1).
type TestDb = Parameters<typeof listAuthors>[1];

const BLOG = "default";

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE authors (
    pk text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    job_title text DEFAULT '',
    bio text DEFAULT '' NOT NULL,
    avatar_url text DEFAULT '',
    email text DEFAULT '',
    same_as text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX authors_blog_slug_idx ON authors (blog_id, slug);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("authors repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("lists empty initially", async () => {
    expect(await listAuthors(BLOG, db)).toEqual([]);
  });

  it("creates an author and round-trips id===slug, sameAs, and all fields", async () => {
    const result = await createAuthor(
      BLOG,
      {
        id: "jane-doe",
        name: "Jane Doe",
        jobTitle: "Editor",
        bio: "A great editor",
        avatarUrl: "https://example.com/jane.jpg",
        email: "jane@example.com",
        sameAs: ["https://twitter.com/jane", "https://linkedin.com/in/jane"],
      },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");

    const entry = result.entry;
    expect(entry.id).toBe("jane-doe"); // id maps to slug
    expect(entry.name).toBe("Jane Doe");
    expect(entry.jobTitle).toBe("Editor");
    expect(entry.bio).toBe("A great editor");
    expect(entry.avatarUrl).toBe("https://example.com/jane.jpg");
    expect(entry.email).toBe("jane@example.com");
    expect(entry.sameAs).toEqual(["https://twitter.com/jane", "https://linkedin.com/in/jane"]);
    expect(typeof entry.createdAt).toBe("string");
    expect(typeof entry.updatedAt).toBe("string");
  });

  it("creates with defaults for optional fields", async () => {
    const result = await createAuthor(BLOG, { id: "minimal", name: "Minimal Author" }, db);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const entry = result.entry;
    expect(entry.id).toBe("minimal");
    expect(entry.jobTitle).toBe("");
    expect(entry.bio).toBe("");
    expect(entry.avatarUrl).toBe("");
    expect(entry.email).toBe("");
    expect(entry.sameAs).toEqual([]);
  });

  it("rejects a duplicate slug (same blogId)", async () => {
    await createAuthor(BLOG, { id: "dup-slug", name: "First" }, db);
    const result = await createAuthor(BLOG, { id: "dup-slug", name: "Second" }, db);
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("gets a single author by slug", async () => {
    await createAuthor(BLOG, { id: "get-me", name: "Get Me" }, db);
    const author = await getAuthor(BLOG, "get-me", db);
    expect(author).not.toBeNull();
    expect(author?.id).toBe("get-me");
    expect(author?.name).toBe("Get Me");
  });

  it("returns null for a missing author", async () => {
    expect(await getAuthor(BLOG, "no-such-slug", db)).toBeNull();
  });

  it("lists authors ordered by name ascending", async () => {
    await createAuthor(BLOG, { id: "zzz", name: "Zara" }, db);
    await createAuthor(BLOG, { id: "aaa", name: "Alice" }, db);
    await createAuthor(BLOG, { id: "mmm", name: "Mike" }, db);
    const list = await listAuthors(BLOG, db);
    expect(list.map((a) => a.name)).toEqual(["Alice", "Mike", "Zara"]);
  });

  it("updates partial fields", async () => {
    await createAuthor(BLOG, { id: "update-me", name: "Original", bio: "Old bio" }, db);
    const updated = await updateAuthor(BLOG, "update-me", { name: "Updated Name" }, db);
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated Name");
    expect(updated?.bio).toBe("Old bio"); // unchanged
    expect(updated?.id).toBe("update-me");
  });

  it("updates sameAs (round-trip via JSON)", async () => {
    await createAuthor(BLOG, { id: "same-as-author", name: "Sam", sameAs: ["https://a.com"] }, db);
    const updated = await updateAuthor(BLOG, "same-as-author", { sameAs: ["https://b.com", "https://c.com"] }, db);
    expect(updated?.sameAs).toEqual(["https://b.com", "https://c.com"]);
  });

  it("returns null updating a missing author", async () => {
    expect(await updateAuthor(BLOG, "no-such", { name: "X" }, db)).toBeNull();
  });

  it("deletes an author", async () => {
    await createAuthor(BLOG, { id: "del-me", name: "Delete Me" }, db);
    expect(await deleteAuthor(BLOG, "del-me", db)).toBe(true);
    expect(await deleteAuthor(BLOG, "del-me", db)).toBe(false);
    expect(await listAuthors(BLOG, db)).toEqual([]);
  });

  it("isolates authors by blogId — same slug allowed, operations scoped", async () => {
    await createAuthor("blog-a", { id: "shared-slug", name: "Author A" }, db);
    await createAuthor("blog-b", { id: "shared-slug", name: "Author B" }, db);

    const a = await listAuthors("blog-a", db);
    const b = await listAuthors("blog-b", db);
    expect(a.map((x) => x.name)).toEqual(["Author A"]);
    expect(b.map((x) => x.name)).toEqual(["Author B"]);

    // Deleting from blog-a must not touch blog-b.
    expect(await deleteAuthor("blog-a", "shared-slug", db)).toBe(true);
    expect(await listAuthors("blog-a", db)).toEqual([]);
    expect((await listAuthors("blog-b", db)).map((x) => x.id)).toEqual(["shared-slug"]);
  });

  it("ensurePlaceholderAuthor seeds once when empty", async () => {
    await ensurePlaceholderAuthor(BLOG, db);
    const list = await listAuthors(BLOG, db);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("blogbat-editorial-team");
    expect(list[0].name).toBe("Supportsheep Editorial Team");
    expect(list[0].sameAs).toEqual(["https://supportsheep.com"]);
  });

  it("ensurePlaceholderAuthor is idempotent (no-op when authors exist)", async () => {
    await createAuthor(BLOG, { id: "existing-author", name: "Existing" }, db);
    await ensurePlaceholderAuthor(BLOG, db);
    const list = await listAuthors(BLOG, db);
    // placeholder was NOT inserted because collection was non-empty
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("existing-author");
  });

  it("ensurePlaceholderAuthor calling twice is idempotent", async () => {
    await ensurePlaceholderAuthor(BLOG, db);
    await ensurePlaceholderAuthor(BLOG, db);
    expect(await listAuthors(BLOG, db)).toHaveLength(1);
  });
});
