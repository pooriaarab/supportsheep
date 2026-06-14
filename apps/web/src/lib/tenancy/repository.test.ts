import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/tenancy/repository");

import * as schema from "@/db/schema";

import {
  getMembershipByUser,
  listMemberUserIdsByRoles,
  NeedsOnboardingError,
  resolveTenantForUser,
} from "./repository";

type TestDb = NonNullable<Parameters<typeof resolveTenantForUser>[1]>;

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
    `INSERT INTO blogs (id, slug, custom_domain, display_name, created_at, updated_at)
     VALUES ('default','default',NULL,'Supportsheep','t','t');`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const session = (uid: string) => ({ uid, email: `${uid}@x.test`, authTime: 0 });

describe("tenancy repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("throws NeedsOnboardingError when the user has no membership (no auto-join)", async () => {
    expect(await getMembershipByUser("u1", db)).toBeNull();
    await expect(resolveTenantForUser(session("u1"), db)).rejects.toBeInstanceOf(
      NeedsOnboardingError,
    );
    // It must NOT create a membership as a side effect.
    expect(await getMembershipByUser("u1", db)).toBeNull();
    const rows = await db.select().from(schema.blogMembers);
    expect(rows).toHaveLength(0);
  });

  it("returns the existing role when a membership already exists (does not downgrade)", async () => {
    await db.insert(schema.blogMembers).values({
      id: "m1",
      blogId: "default",
      userId: "u2",
      role: "viewer",
    });
    expect(await resolveTenantForUser(session("u2"), db)).toEqual({
      blogId: "default",
      role: "viewer",
    });
  });

  it("isolates tenants — a user's membership is scoped to their own row", async () => {
    await db.insert(schema.blogs).values({
      id: "b2",
      slug: "other",
      displayName: "Other",
      createdAt: "t",
      updatedAt: "t",
    });
    await db.insert(schema.blogMembers).values({
      id: "m2",
      blogId: "b2",
      userId: "u3",
      role: "admin",
    });
    // A user with no membership needs onboarding rather than landing on a
    // shared blog.
    await expect(resolveTenantForUser(session("u4"), db)).rejects.toBeInstanceOf(
      NeedsOnboardingError,
    );
    expect(await resolveTenantForUser(session("u3"), db)).toEqual({
      blogId: "b2",
      role: "admin",
    });
  });

  describe("active-blog cookie hint (only a hint — membership always re-verified)", () => {
    beforeEach(async () => {
      await db.insert(schema.blogs).values({
        id: "b2",
        slug: "other",
        displayName: "Other",
        createdAt: "t",
        updatedAt: "t",
      });
      // u1 is a member of BOTH the default blog (earliest) and b2.
      await db.insert(schema.blogMembers).values([
        {
          id: "m-default",
          blogId: "default",
          userId: "u1",
          role: "owner",
          createdAt: "2024-01-01",
        },
        {
          id: "m-b2",
          blogId: "b2",
          userId: "u1",
          role: "editor",
          createdAt: "2024-02-01",
        },
      ]);
    });

    it("returns the hinted blog when the user is a member of it", async () => {
      expect(await resolveTenantForUser(session("u1"), db, "b2")).toEqual({
        blogId: "b2",
        role: "editor",
      });
    });

    it("ignores the hint and falls back to the earliest membership when the user is NOT a member of the hinted blog", async () => {
      // u1 is not a member of "b-nope" → the hint is dropped, earliest wins.
      expect(await resolveTenantForUser(session("u1"), db, "b-nope")).toEqual({
        blogId: "default",
        role: "owner",
      });
    });

    it("falls back to the earliest membership when there is no hint", async () => {
      expect(await resolveTenantForUser(session("u1"), db, null)).toEqual({
        blogId: "default",
        role: "owner",
      });
    });

    it("still throws NeedsOnboardingError when a hint is present but the user has no membership at all", async () => {
      await expect(
        resolveTenantForUser(session("stranger"), db, "b2"),
      ).rejects.toBeInstanceOf(NeedsOnboardingError);
    });
  });

  describe("listMemberUserIdsByRoles", () => {
    beforeEach(async () => {
      await db.insert(schema.blogs).values({
        id: "b2",
        slug: "other",
        displayName: "Other",
        createdAt: "t",
        updatedAt: "t",
      });
      await db.insert(schema.blogMembers).values([
        { id: "m1", blogId: "default", userId: "owner-u", role: "owner" },
        { id: "m2", blogId: "default", userId: "admin-u", role: "admin" },
        { id: "m3", blogId: "default", userId: "editor-u", role: "editor" },
        { id: "m4", blogId: "default", userId: "viewer-u", role: "viewer" },
        { id: "m5", blogId: "b2", userId: "other-admin", role: "admin" },
      ]);
    });

    it("returns user IDs for the given roles, scoped to the blog", async () => {
      const ids = await listMemberUserIdsByRoles(
        "default",
        ["owner", "admin", "editor"],
        db,
      );
      expect(ids.sort()).toEqual(["admin-u", "editor-u", "owner-u"]);
    });

    it("does not leak members from other blogs", async () => {
      const ids = await listMemberUserIdsByRoles("default", ["admin"], db);
      expect(ids).toEqual(["admin-u"]);
    });

    it("returns an empty array for an empty role list", async () => {
      expect(await listMemberUserIdsByRoles("default", [], db)).toEqual([]);
    });

    it("returns an empty array when no member matches the roles", async () => {
      expect(
        await listMemberUserIdsByRoles("default", ["guest"], db),
      ).toEqual([]);
    });
  });
});
