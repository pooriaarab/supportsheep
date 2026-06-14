import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createContentPlan,
  deleteContentPlan,
  getContentPlan,
  listContentPlans,
} from "./repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = NonNullable<Parameters<typeof listContentPlans>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE content_plans (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    posts text DEFAULT '[]' NOT NULL,
    provider text DEFAULT 'claude' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX content_plans_blog_idx ON content_plans (blog_id);`,
  );
  await client.execute(
    `CREATE INDEX content_plans_blog_created_idx ON content_plans (blog_id, created_at);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const samplePosts = [
  {
    keyword: "best blogging tools 2026",
    postType: "listicle" as const,
    scheduledDate: "2026-06-10",
    status: "pending" as const,
    articleSlug: null,
    contextTagId: "",
  },
];

describe("content-plans repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listContentPlans
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listContentPlans("blog-1", {}, db)).toEqual([]);
  });

  it("orders deterministically for same-millisecond rows (id tiebreaker)", async () => {
    // Two rows with identical created_at — without an id tiebreaker the order
    // would be nondeterministic. id desc → "zzz" before "aaa".
    const { contentPlans } = schema;
    await db.insert(contentPlans).values([
      {
        id: "aaa",
        blogId: "blog-1",
        name: "A",
        status: "active",
        posts: "[]",
        provider: "claude",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: "zzz",
        blogId: "blog-1",
        name: "Z",
        status: "active",
        posts: "[]",
        provider: "claude",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
    const ids = (await listContentPlans("blog-1", {}, db)).map((p) => p.id);
    expect(ids).toEqual(["zzz", "aaa"]);
  });

  it("respects the limit option", async () => {
    for (let i = 0; i < 5; i++) {
      await createContentPlan(
        "blog-1",
        { name: `Plan ${i}`, posts: samplePosts },
        db,
      );
    }
    const limited = await listContentPlans("blog-1", { limit: 3 }, db);
    expect(limited).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // createContentPlan
  // ---------------------------------------------------------------------------

  it("creates a plan and returns full entry with correct shape", async () => {
    const before = Date.now();
    const result = await createContentPlan(
      "blog-1",
      { name: "My Plan", posts: samplePosts, provider: "gpt" },
      db,
    );
    const after = Date.now();

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.blogId).toBe("blog-1");
    expect(result.name).toBe("My Plan");
    expect(result.status).toBe("active");
    expect(result.provider).toBe("gpt");
    expect(result.posts).toEqual(samplePosts);
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
    expect(result.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("defaults status to active and provider to claude", async () => {
    const result = await createContentPlan(
      "blog-1",
      { name: "Default Plan", posts: [] },
      db,
    );
    expect(result.status).toBe("active");
    expect(result.provider).toBe("claude");
  });

  it("JSON round-trips posts array correctly", async () => {
    const posts = [
      ...samplePosts,
      {
        keyword: "content marketing tips",
        postType: "how_to" as const,
        scheduledDate: "2026-06-11",
        status: "generated" as const,
        articleSlug: "content-marketing-tips",
        contextTagId: "tag-1",
      },
    ];
    const created = await createContentPlan("blog-1", { name: "P", posts }, db);
    expect(created.posts).toEqual(posts);

    // Verify round-trip through DB read
    const fetched = await getContentPlan("blog-1", created.id, db);
    expect(fetched?.posts).toEqual(posts);
  });

  it("list is ordered newest first (created_at desc)", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000) // updatedAt for first create
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2000); // updatedAt for second create
    await createContentPlan("blog-1", { name: "First", posts: [] }, db);
    await createContentPlan("blog-1", { name: "Second", posts: [] }, db);
    nowSpy.mockRestore();

    const list = await listContentPlans("blog-1", {}, db);
    expect(list[0].name).toBe("Second");
    expect(list[1].name).toBe("First");
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — list
  // ---------------------------------------------------------------------------

  it("blog-a cannot list blog-b's plans", async () => {
    await createContentPlan("blog-a", { name: "For A", posts: [] }, db);
    expect(await listContentPlans("blog-b", {}, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // getContentPlan
  // ---------------------------------------------------------------------------

  it("gets a plan by id", async () => {
    const created = await createContentPlan(
      "blog-1",
      { name: "Fetchable", posts: samplePosts },
      db,
    );
    const fetched = await getContentPlan("blog-1", created.id, db);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe("Fetchable");
    expect(fetched?.posts).toEqual(samplePosts);
  });

  it("returns null for non-existent id", async () => {
    expect(await getContentPlan("blog-1", "no-such-id", db)).toBeNull();
  });

  it("get is scoped by blog_id — cannot fetch across blogs", async () => {
    const created = await createContentPlan(
      "blog-a",
      { name: "Private", posts: [] },
      db,
    );
    // blog-b cannot see blog-a's plan
    expect(await getContentPlan("blog-b", created.id, db)).toBeNull();
    // blog-a can still see it
    expect(await getContentPlan("blog-a", created.id, db)).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // deleteContentPlan
  // ---------------------------------------------------------------------------

  it("deletes a plan and returns true; second delete returns false", async () => {
    const created = await createContentPlan(
      "blog-1",
      { name: "Del", posts: [] },
      db,
    );
    expect(await deleteContentPlan("blog-1", created.id, db)).toBe(true);
    expect(await deleteContentPlan("blog-1", created.id, db)).toBe(false);
    expect(await listContentPlans("blog-1", {}, db)).toEqual([]);
  });

  it("delete is scoped by blog_id", async () => {
    const created = await createContentPlan(
      "blog-a",
      { name: "S", posts: [] },
      db,
    );
    // blog-b cannot delete blog-a's plan
    expect(await deleteContentPlan("blog-b", created.id, db)).toBe(false);
    // Still exists in blog-a
    expect(await listContentPlans("blog-a", {}, db)).toHaveLength(1);
  });

  it("returns false for a non-existent plan", async () => {
    expect(await deleteContentPlan("blog-1", "nonexistent-id", db)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — combined
  // ---------------------------------------------------------------------------

  it("plan in blog-a is not visible/deletable from blog-b", async () => {
    const created = await createContentPlan(
      "blog-a",
      { name: "Private", posts: samplePosts },
      db,
    );

    // blog-b cannot see it
    expect(await listContentPlans("blog-b", {}, db)).toEqual([]);
    // blog-b cannot get it
    expect(await getContentPlan("blog-b", created.id, db)).toBeNull();
    // blog-b cannot delete it
    expect(await deleteContentPlan("blog-b", created.id, db)).toBe(false);
    // blog-a plan still intact
    const still = await listContentPlans("blog-a", {}, db);
    expect(still).toHaveLength(1);
    expect(still[0].name).toBe("Private");
  });
});
