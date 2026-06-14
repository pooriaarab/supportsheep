import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from "./repository";

// Real in-memory SQLite (libsql) so the drizzle queries actually run (async, like D1).
type TestDb = Parameters<typeof listCategories>[1];

const BLOG = "default";

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE categories (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    icon text DEFAULT '',
    sort_order integer DEFAULT 0 NOT NULL,
    post_count integer DEFAULT 0 NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX categories_blog_slug_idx ON categories (blog_id, slug);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("categories repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("lists empty initially", async () => {
    expect(await listCategories(BLOG, db)).toEqual([]);
  });

  it("creates with incrementing order and postCount 0", async () => {
    const a = await createCategory(BLOG, { slug: "news", displayName: "News" }, db);
    const b = await createCategory(
      BLOG,
      { slug: "guides", displayName: "Guides", icon: "book", description: "How-tos" },
      db,
    );
    expect(a).toEqual({ ok: true, entry: expect.objectContaining({ slug: "news", order: 0, postCount: 0, icon: "" }) });
    expect(b).toEqual({ ok: true, entry: expect.objectContaining({ slug: "guides", order: 1, icon: "book", description: "How-tos" }) });
  });

  it("rejects a duplicate slug", async () => {
    await createCategory(BLOG, { slug: "news", displayName: "News" }, db);
    expect(await createCategory(BLOG, { slug: "news", displayName: "Dup" }, db)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("lists ordered and shaped", async () => {
    await createCategory(BLOG, { slug: "a", displayName: "A" }, db);
    await createCategory(BLOG, { slug: "b", displayName: "B" }, db);
    const list = await listCategories(BLOG, db);
    expect(list.map((c) => c.slug)).toEqual(["a", "b"]);
    expect(list[0]).toEqual({ slug: "a", displayName: "A", order: 0, icon: "", description: "", postCount: 0 });
  });

  it("updates fields", async () => {
    await createCategory(BLOG, { slug: "a", displayName: "A" }, db);
    const updated = await updateCategory(BLOG, "a", { displayName: "Alpha", icon: "star" }, db);
    expect(updated).toEqual(expect.objectContaining({ slug: "a", displayName: "Alpha", icon: "star" }));
  });

  it("returns null updating a missing category", async () => {
    expect(await updateCategory(BLOG, "missing", { displayName: "X" }, db)).toBeNull();
  });

  it("deletes", async () => {
    await createCategory(BLOG, { slug: "a", displayName: "A" }, db);
    expect(await deleteCategory(BLOG, "a", db)).toBe(true);
    expect(await deleteCategory(BLOG, "a", db)).toBe(false);
    expect(await listCategories(BLOG, db)).toEqual([]);
  });

  it("reorders", async () => {
    await createCategory(BLOG, { slug: "a", displayName: "A" }, db);
    await createCategory(BLOG, { slug: "b", displayName: "B" }, db);
    const n = await reorderCategories(BLOG, { a: 5, b: 2 }, db);
    expect(n).toBe(2);
    expect((await listCategories(BLOG, db)).map((c) => c.slug)).toEqual(["b", "a"]);
  });

  it("isolates categories by blogId", async () => {
    await createCategory("blog-a", { slug: "shared", displayName: "A" }, db);
    await createCategory("blog-b", { slug: "shared", displayName: "B" }, db);

    const a = await listCategories("blog-a", db);
    const b = await listCategories("blog-b", db);
    expect(a.map((c) => c.displayName)).toEqual(["A"]);
    expect(b.map((c) => c.displayName)).toEqual(["B"]);

    // Same slug in two blogs is allowed (uniqueness is per-blog).
    // Deleting in blog-a must not touch blog-b.
    expect(await deleteCategory("blog-a", "shared", db)).toBe(true);
    expect(await listCategories("blog-a", db)).toEqual([]);
    expect((await listCategories("blog-b", db)).map((c) => c.slug)).toEqual([
      "shared",
    ]);
  });
});
