import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  addMemberByEmail,
  getBlogMember,
  listBlogMembers,
  removeBlogMembers,
  updateMemberRole,
} from "./members";

// Real in-memory SQLite so the knowledge base_members ⋈ user join actually executes.
type TestDb = NonNullable<Parameters<typeof listBlogMembers>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified integer DEFAULT false NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
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

async function seedUser(
  db: TestDb,
  u: { id: string; name: string; email: string; image?: string | null },
): Promise<void> {
  await db.insert(schema.user).values({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });
}

describe("members repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // listBlogMembers
  // -------------------------------------------------------------------------

  it("joins blog_members with user and maps to the AppUser shape", async () => {
    await seedUser(db, {
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
      image: "https://img/ada.png",
    });
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "b1",
      userId: "u1",
      role: "owner",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const members = await listBlogMembers("b1", {}, db);
    expect(members).toEqual([
      {
        id: "u1",
        name: "Ada",
        email: "ada@example.com",
        role: "owner",
        avatarUrl: "https://img/ada.png",
        joinedAt: "2024-01-01T00:00:00.000Z",
        status: "active",
      },
    ]);
  });

  it("maps a null user image to an empty avatarUrl", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "b1",
      userId: "u1",
      role: "viewer",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const [member] = await listBlogMembers("b1", {}, db);
    expect(member.avatarUrl).toBe("");
  });

  it("orders by createdAt desc then id", async () => {
    await seedUser(db, { id: "u1", name: "First", email: "first@example.com" });
    await seedUser(db, { id: "u2", name: "Second", email: "second@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m-old",
        blogId: "b1",
        userId: "u1",
        role: "viewer",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m-new",
        blogId: "b1",
        userId: "u2",
        role: "viewer",
        createdAt: "2024-02-01T00:00:00.000Z",
      },
    ]);

    const members = await listBlogMembers("b1", {}, db);
    expect(members.map((m) => m.id)).toEqual(["u2", "u1"]);
  });

  it("isolates tenants — only returns the requested blog's members", async () => {
    await seedUser(db, { id: "u1", name: "Mine", email: "mine@example.com" });
    await seedUser(db, { id: "u2", name: "Theirs", email: "theirs@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b2",
        userId: "u2",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const b1 = await listBlogMembers("b1", {}, db);
    expect(b1.map((m) => m.id)).toEqual(["u1"]);
  });

  it("honors limit and offset", async () => {
    for (let i = 0; i < 3; i++) {
      await seedUser(db, {
        id: `u${i}`,
        name: `User ${i}`,
        email: `u${i}@example.com`,
      });
      await db.insert(schema.blogMembers).values({
        id: `m${i}`,
        blogId: "b1",
        userId: `u${i}`,
        role: "viewer",
        // ascending createdAt so desc order is u2, u1, u0
        createdAt: `2024-01-0${i + 1}T00:00:00.000Z`,
      });
    }
    const page = await listBlogMembers("b1", { limit: 1, offset: 1 }, db);
    expect(page.map((m) => m.id)).toEqual(["u1"]);
  });

  // -------------------------------------------------------------------------
  // getBlogMember
  // -------------------------------------------------------------------------

  it("getBlogMember returns the member or null", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "b1",
      userId: "u1",
      role: "editor",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    expect((await getBlogMember("b1", "u1", db))?.role).toBe("editor");
    expect(await getBlogMember("b1", "nobody", db)).toBeNull();
    // userId exists but on a different blog
    expect(await getBlogMember("b2", "u1", db)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // updateMemberRole
  // -------------------------------------------------------------------------

  it("updateMemberRole changes a member's role", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await seedUser(db, { id: "u2", name: "Bob", email: "bob@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b1",
        userId: "u2",
        role: "viewer",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);

    const result = await updateMemberRole("b1", "u2", "editor", db);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.member.role).toBe("editor");
  });

  it("updateMemberRole returns not_found for a non-member", async () => {
    const result = await updateMemberRole("b1", "ghost", "editor", db);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("updateMemberRole blocks demoting the last owner", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "b1",
      userId: "u1",
      role: "owner",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const result = await updateMemberRole("b1", "u1", "viewer", db);
    expect(result).toEqual({ ok: false, reason: "last_owner" });
    // role unchanged
    expect((await getBlogMember("b1", "u1", db))?.role).toBe("owner");
  });

  it("updateMemberRole allows demoting an owner when another owner remains", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await seedUser(db, { id: "u2", name: "Bob", email: "bob@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b1",
        userId: "u2",
        role: "owner",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);

    const result = await updateMemberRole("b1", "u1", "viewer", db);
    expect(result.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // removeBlogMembers
  // -------------------------------------------------------------------------

  it("removeBlogMembers deletes memberships and returns the count", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await seedUser(db, { id: "u2", name: "Bob", email: "bob@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b1",
        userId: "u2",
        role: "viewer",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);

    const result = await removeBlogMembers("b1", ["u2"], db);
    expect(result).toEqual({ ok: true, removed: 1 });
    expect(await getBlogMember("b1", "u2", db)).toBeNull();
    expect(await getBlogMember("b1", "u1", db)).not.toBeNull();
  });

  it("removeBlogMembers blocks removing the last owner", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await seedUser(db, { id: "u2", name: "Bob", email: "bob@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b1",
        userId: "u2",
        role: "viewer",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);

    const result = await removeBlogMembers("b1", ["u1", "u2"], db);
    expect(result).toEqual({ ok: false, reason: "last_owner" });
    // nothing deleted
    expect(await getBlogMember("b1", "u1", db)).not.toBeNull();
    expect(await getBlogMember("b1", "u2", db)).not.toBeNull();
  });

  it("removeBlogMembers allows removing one owner when another remains", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await seedUser(db, { id: "u2", name: "Bob", email: "bob@example.com" });
    await db.insert(schema.blogMembers).values([
      {
        id: "m1",
        blogId: "b1",
        userId: "u1",
        role: "owner",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blogId: "b1",
        userId: "u2",
        role: "owner",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ]);

    const result = await removeBlogMembers("b1", ["u1"], db);
    expect(result).toEqual({ ok: true, removed: 1 });
  });

  // -------------------------------------------------------------------------
  // addMemberByEmail
  // -------------------------------------------------------------------------

  it("addMemberByEmail adds an existing user and returns the member", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });

    const result = await addMemberByEmail("b1", "ada@example.com", "editor", db);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.member).toMatchObject({
      id: "u1",
      email: "ada@example.com",
      role: "editor",
      status: "active",
    });
  });

  it("addMemberByEmail returns user_not_found for an unknown email", async () => {
    const result = await addMemberByEmail("b1", "ghost@example.com", "viewer", db);
    expect(result).toEqual({ ok: false, reason: "user_not_found" });
  });

  it("addMemberByEmail returns already_member when the user is already on the knowledge base", async () => {
    await seedUser(db, { id: "u1", name: "Ada", email: "ada@example.com" });
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "b1",
      userId: "u1",
      role: "viewer",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const result = await addMemberByEmail("b1", "ada@example.com", "editor", db);
    expect(result).toEqual({ ok: false, reason: "already_member" });
  });
});
