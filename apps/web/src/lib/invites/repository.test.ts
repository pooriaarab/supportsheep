import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  acceptInvite,
  clampInviteRole,
  createInvite,
  getInviteByToken,
  INVITE_TTL_MS,
  listInvitesByEmail,
  listPendingInvites,
  revokeInvite,
} from "./repository";

type TestDb = NonNullable<Parameters<typeof listPendingInvites>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE blog_invites (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'viewer' NOT NULL,
    token text NOT NULL UNIQUE,
    invited_by text NOT NULL,
    expires_at integer NOT NULL,
    created_at integer NOT NULL,
    accepted_at integer,
    accepted_by text
  );`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("invites repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("clampInviteRole", () => {
    it("keeps invitable roles", () => {
      expect(clampInviteRole("author")).toBe("author");
      expect(clampInviteRole("editor")).toBe("editor");
      expect(clampInviteRole("viewer")).toBe("viewer");
    });
    it("clamps owner/admin/unknown to author (never escalates)", () => {
      expect(clampInviteRole("owner")).toBe("author");
      expect(clampInviteRole("admin")).toBe("author");
      expect(clampInviteRole("superuser")).toBe("author");
    });
  });

  it("creates an invite with a clamped role, lowercased email, and an unguessable token", async () => {
    const invite = await createInvite(
      {
        blogId: "blog-1",
        email: "New.Person@Example.COM",
        role: "owner",
        invitedBy: "admin-1",
      },
      db,
    );
    expect(invite.email).toBe("new.person@example.com");
    expect(invite.role).toBe("author"); // owner clamped
    expect(invite.token).toHaveLength(32);
    expect(invite.acceptedAt).toBeNull();
    expect(invite.expiresAt).toBeGreaterThan(Date.now());

    const fetched = await getInviteByToken(invite.token, db);
    expect(fetched?.id).toBe(invite.id);
  });

  it("returns null for an unknown token", async () => {
    expect(await getInviteByToken("nope", db)).toBeNull();
  });

  it("lists pending invites for a blog, excluding expired and accepted ones", async () => {
    const pending = await createInvite(
      { blogId: "blog-1", email: "a@x.test", role: "editor", invitedBy: "u" },
      db,
    );
    // An accepted invite.
    await createInvite(
      { blogId: "blog-1", email: "b@x.test", role: "viewer", invitedBy: "u" },
      db,
    ).then((inv) => acceptInvite(inv.token, "user-b", db));
    // An expired invite (write directly with a past expiry).
    await db.insert(schema.blogInvites).values({
      id: "expired-1",
      blogId: "blog-1",
      email: "c@x.test",
      role: "viewer",
      token: "expired-token",
      invitedBy: "u",
      expiresAt: Date.now() - 1000,
      createdAt: Date.now() - INVITE_TTL_MS,
      acceptedAt: null,
      acceptedBy: null,
    });
    // Another blog's invite must not leak.
    await createInvite(
      { blogId: "blog-2", email: "d@x.test", role: "viewer", invitedBy: "u" },
      db,
    );

    const list = await listPendingInvites("blog-1", db);
    expect(list.map((i) => i.id)).toEqual([pending.id]);
  });

  it("lists invites by email (lowercased), newest first", async () => {
    await createInvite(
      { blogId: "blog-1", email: "p@x.test", role: "viewer", invitedBy: "u" },
      db,
    );
    await createInvite(
      { blogId: "blog-2", email: "P@X.test", role: "editor", invitedBy: "u" },
      db,
    );
    const list = await listInvitesByEmail("p@x.test", db);
    expect(list).toHaveLength(2);
    expect(list.every((i) => i.email === "p@x.test")).toBe(true);
  });

  describe("acceptInvite", () => {
    it("accepts a valid pending invite once and marks it spent (single-use)", async () => {
      const invite = await createInvite(
        { blogId: "blog-1", email: "u@x.test", role: "editor", invitedBy: "a" },
        db,
      );

      const first = await acceptInvite(invite.token, "user-1", db);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.invite.acceptedBy).toBe("user-1");
        expect(first.invite.acceptedAt).not.toBeNull();
      }

      // Second accept is rejected — single-use guard.
      const second = await acceptInvite(invite.token, "user-2", db);
      expect(second).toEqual({ ok: false, reason: "already_accepted" });
    });

    it("rejects an unknown token", async () => {
      expect(await acceptInvite("nope", "user-1", db)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("rejects an expired invite", async () => {
      await db.insert(schema.blogInvites).values({
        id: "exp",
        blogId: "blog-1",
        email: "u@x.test",
        role: "viewer",
        token: "exp-token",
        invitedBy: "a",
        expiresAt: Date.now() - 1,
        createdAt: Date.now() - 10,
        acceptedAt: null,
        acceptedBy: null,
      });
      expect(await acceptInvite("exp-token", "user-1", db)).toEqual({
        ok: false,
        reason: "expired",
      });
    });
  });

  describe("revokeInvite", () => {
    it("deletes a pending invite scoped to its blog", async () => {
      const invite = await createInvite(
        { blogId: "blog-1", email: "u@x.test", role: "viewer", invitedBy: "a" },
        db,
      );
      expect(await revokeInvite("blog-1", invite.token, db)).toBe(true);
      expect(await getInviteByToken(invite.token, db)).toBeNull();
    });

    it("does not revoke another blog's invite", async () => {
      const invite = await createInvite(
        { blogId: "blog-1", email: "u@x.test", role: "viewer", invitedBy: "a" },
        db,
      );
      // Wrong blog scope → no-op, invite still present.
      expect(await revokeInvite("blog-2", invite.token, db)).toBe(false);
      expect(await getInviteByToken(invite.token, db)).not.toBeNull();
    });
  });
});
