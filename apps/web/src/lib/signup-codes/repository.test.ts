import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createSignupCode,
  getSignupCodeByCode,
  listSignupCodes,
  redeemSignupCode,
} from "./repository";

type TestDb = Parameters<typeof getSignupCodeByCode>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE signup_codes (
    id text PRIMARY KEY NOT NULL,
    code text NOT NULL,
    blog_id text NOT NULL,
    role text DEFAULT 'author' NOT NULL,
    note text,
    max_uses integer DEFAULT 1 NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    expires_at integer,
    created_by text NOT NULL,
    created_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX signup_codes_code_idx ON signup_codes (code);`,
  );
  await client.execute(
    `CREATE INDEX signup_codes_blog_idx ON signup_codes (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("signup-codes repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("creates a code with a random token and grantable defaults", async () => {
    const created = await createSignupCode(
      { blogId: "blog-1", role: "author", createdBy: "admin-1" },
      db,
    );

    expect(created.blogId).toBe("blog-1");
    expect(created.role).toBe("author");
    expect(created.maxUses).toBe(1);
    expect(created.uses).toBe(0);
    expect(created.expiresAt).toBeNull();
    expect(created.createdBy).toBe("admin-1");
    // Unguessable nanoid(24) token.
    expect(created.code).toHaveLength(24);
  });

  it("clamps non-grantable roles (owner/admin) to author", async () => {
    const owner = await createSignupCode(
      { blogId: "blog-1", role: "owner", createdBy: "admin-1" },
      db,
    );
    const admin = await createSignupCode(
      { blogId: "blog-1", role: "admin", createdBy: "admin-1" },
      db,
    );
    expect(owner.role).toBe("author");
    expect(admin.role).toBe("author");
  });

  it("allows editor and viewer roles", async () => {
    const editor = await createSignupCode(
      { blogId: "blog-1", role: "editor", createdBy: "admin-1" },
      db,
    );
    expect(editor.role).toBe("editor");
  });

  it("gets a code by its token, null when missing", async () => {
    const created = await createSignupCode(
      { blogId: "blog-1", role: "author", createdBy: "admin-1" },
      db,
    );
    const found = await getSignupCodeByCode(created.code, db);
    expect(found?.id).toBe(created.id);
    await expect(getSignupCodeByCode("nope", db)).resolves.toBeNull();
  });

  it("redeems a valid code and increments uses", async () => {
    const created = await createSignupCode(
      { blogId: "blog-9", role: "editor", maxUses: 1, createdBy: "admin-1" },
      db,
    );

    const result = await redeemSignupCode(created.code, db);
    expect(result).toEqual({ ok: true, blogId: "blog-9", role: "editor" });

    const after = await getSignupCodeByCode(created.code, db);
    expect(after?.uses).toBe(1);
  });

  it("returns not_found for an unknown code", async () => {
    await expect(redeemSignupCode("missing", db)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("returns expired for a past expiry", async () => {
    const created = await createSignupCode(
      {
        blogId: "blog-1",
        role: "author",
        createdBy: "admin-1",
        expiresAtMs: Date.now() - 1000,
      },
      db,
    );
    await expect(redeemSignupCode(created.code, db)).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("returns exhausted once maxUses is reached", async () => {
    const created = await createSignupCode(
      { blogId: "blog-1", role: "author", maxUses: 2, createdBy: "admin-1" },
      db,
    );

    await expect(redeemSignupCode(created.code, db)).resolves.toMatchObject({
      ok: true,
    });
    await expect(redeemSignupCode(created.code, db)).resolves.toMatchObject({
      ok: true,
    });
    await expect(redeemSignupCode(created.code, db)).resolves.toEqual({
      ok: false,
      reason: "exhausted",
    });

    const after = await getSignupCodeByCode(created.code, db);
    expect(after?.uses).toBe(2);
  });

  it("never lets uses exceed maxUses across many redemptions", async () => {
    const created = await createSignupCode(
      { blogId: "blog-1", role: "author", maxUses: 3, createdBy: "admin-1" },
      db,
    );
    let ok = 0;
    for (let i = 0; i < 10; i++) {
      const r = await redeemSignupCode(created.code, db);
      if (r.ok) ok++;
    }
    expect(ok).toBe(3);
    const after = await getSignupCodeByCode(created.code, db);
    expect(after?.uses).toBe(3);
  });

  it("lists codes scoped to a blog, newest first", async () => {
    await createSignupCode(
      { blogId: "blog-a", role: "author", createdBy: "admin-1" },
      db,
    );
    await createSignupCode(
      { blogId: "blog-b", role: "author", createdBy: "admin-1" },
      db,
    );
    await createSignupCode(
      { blogId: "blog-a", role: "editor", createdBy: "admin-1" },
      db,
    );

    const listA = await listSignupCodes("blog-a", db);
    expect(listA).toHaveLength(2);
    expect(listA.every((c) => c.blogId === "blog-a")).toBe(true);

    const listB = await listSignupCodes("blog-b", db);
    expect(listB).toHaveLength(1);
  });
});
