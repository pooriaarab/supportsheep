import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createBlog,
  listBlogsForUser,
  slugAvailable,
  validateSlug,
} from "./blogs";

// Real in-memory SQLite so drizzle queries (and db.batch) actually execute.
type TestDb = NonNullable<Parameters<typeof createBlog>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE blogs (
    id text PRIMARY KEY NOT NULL,
    slug text NOT NULL UNIQUE,
    custom_domain text UNIQUE,
    custom_domain_status text,
    custom_domain_hostname_id text,
    custom_domain_verified_at integer,
    custom_domain_last_checked_at integer,
    custom_domain_notified_status text,
    custom_domain_failure_reason text,
    display_name text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );`);
  await client.execute(`CREATE TABLE blog_members (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'viewer' NOT NULL,
    created_at text NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX blog_members_blog_user_idx ON blog_members (blog_id, user_id);`,
  );
  await client.execute(
    `CREATE INDEX blog_members_user_idx ON blog_members (user_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("validateSlug", () => {
  it("accepts a valid slug", () => {
    expect(validateSlug("my-blog")).toEqual({ ok: true });
    expect(validateSlug("abc")).toEqual({ ok: true });
    expect(validateSlug("a1b2c3")).toEqual({ ok: true });
  });

  it("lowercases before validating", () => {
    expect(validateSlug("My-Blog")).toEqual({ ok: true });
  });

  it("rejects slugs shorter than 3 chars", () => {
    expect(validateSlug("ab")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects slugs longer than 32 chars", () => {
    expect(validateSlug("a".repeat(33))).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects invalid characters", () => {
    expect(validateSlug("my_blog")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(validateSlug("my blog")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(validateSlug("my.blog")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects leading and trailing hyphens", () => {
    expect(validateSlug("-blog")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(validateSlug("blog-")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects double hyphens", () => {
    expect(validateSlug("my--blog")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects reserved slugs", () => {
    expect(validateSlug("www")).toEqual({ ok: false, reason: "reserved" });
    expect(validateSlug("admin")).toEqual({ ok: false, reason: "reserved" });
    expect(validateSlug("default")).toEqual({ ok: false, reason: "reserved" });
    expect(validateSlug("API")).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("blogs repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // slugAvailable
  // -------------------------------------------------------------------------

  it("slugAvailable is true for an unclaimed slug, false once taken", async () => {
    expect(await slugAvailable("my-blog", db)).toBe(true);
    await createBlog(
      { slug: "my-blog", displayName: "My Blog", ownerUserId: "u1" },
      db,
    );
    expect(await slugAvailable("my-blog", db)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // createBlog
  // -------------------------------------------------------------------------

  it("creates a blog and an owner membership atomically (both rows)", async () => {
    const result = await createBlog(
      { slug: "my-blog", displayName: "My Blog", ownerUserId: "u1" },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.blog).toEqual({
      id: expect.any(String),
      slug: "my-blog",
      displayName: "My Blog",
      role: "owner",
    });

    // Assert BOTH rows were written.
    const blogRows = await db
      .select()
      .from(schema.blogs)
      .where(eq(schema.blogs.id, result.blog.id));
    expect(blogRows).toHaveLength(1);
    expect(blogRows[0].slug).toBe("my-blog");
    expect(blogRows[0].displayName).toBe("My Blog");

    const memberRows = await db
      .select()
      .from(schema.blogMembers)
      .where(eq(schema.blogMembers.blogId, result.blog.id));
    expect(memberRows).toHaveLength(1);
    expect(memberRows[0].userId).toBe("u1");
    expect(memberRows[0].role).toBe("owner");
  });

  it("lowercases the slug on create", async () => {
    const result = await createBlog(
      { slug: "My-Blog", displayName: "My Blog", ownerUserId: "u1" },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.blog.slug).toBe("my-blog");
  });

  it("rejects a duplicate slug with slug_taken", async () => {
    await createBlog(
      { slug: "taken", displayName: "First", ownerUserId: "u1" },
      db,
    );
    const result = await createBlog(
      { slug: "taken", displayName: "Second", ownerUserId: "u2" },
      db,
    );
    expect(result).toEqual({ ok: false, reason: "slug_taken" });

    // No partial write: still exactly one blog with that slug, no orphan member.
    const blogRows = await db
      .select()
      .from(schema.blogs)
      .where(eq(schema.blogs.slug, "taken"));
    expect(blogRows).toHaveLength(1);
    const memberRows = await db
      .select()
      .from(schema.blogMembers)
      .where(eq(schema.blogMembers.userId, "u2"));
    expect(memberRows).toHaveLength(0);
  });

  it("rejects a reserved slug without writing", async () => {
    const result = await createBlog(
      { slug: "admin", displayName: "Admin", ownerUserId: "u1" },
      db,
    );
    expect(result).toEqual({ ok: false, reason: "reserved" });
    expect(await db.select().from(schema.blogs)).toHaveLength(0);
  });

  it("rejects an invalid slug without writing", async () => {
    const result = await createBlog(
      { slug: "no", displayName: "Too Short", ownerUserId: "u1" },
      db,
    );
    expect(result).toEqual({ ok: false, reason: "invalid_format" });
    expect(await db.select().from(schema.blogs)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // listBlogsForUser
  // -------------------------------------------------------------------------

  it("lists empty when the user has no memberships", async () => {
    expect(await listBlogsForUser("nobody", db)).toEqual([]);
  });

  it("lists the user's blogs with role, ordered by createdAt then id", async () => {
    // Insert blogs with explicit createdAt to assert ordering deterministically.
    await db.insert(schema.blogs).values([
      {
        id: "b-second",
        slug: "second",
        displayName: "Second",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
      {
        id: "b-first",
        slug: "first",
        displayName: "First",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    await db.insert(schema.blogMembers).values([
      { id: "m1", blogId: "b-second", userId: "u1", role: "editor" },
      { id: "m2", blogId: "b-first", userId: "u1", role: "owner" },
    ]);

    const list = await listBlogsForUser("u1", db);
    expect(list).toEqual([
      { id: "b-first", slug: "first", displayName: "First", role: "owner" },
      { id: "b-second", slug: "second", displayName: "Second", role: "editor" },
    ]);
  });

  it("isolates tenants — only returns the user's own blogs", async () => {
    await createBlog(
      { slug: "mine", displayName: "Mine", ownerUserId: "u1" },
      db,
    );
    await createBlog(
      { slug: "theirs", displayName: "Theirs", ownerUserId: "u2" },
      db,
    );

    const u1 = await listBlogsForUser("u1", db);
    expect(u1).toHaveLength(1);
    expect(u1[0].slug).toBe("mine");
    expect(u1[0].role).toBe("owner");

    const u2 = await listBlogsForUser("u2", db);
    expect(u2).toHaveLength(1);
    expect(u2[0].slug).toBe("theirs");
  });
});
