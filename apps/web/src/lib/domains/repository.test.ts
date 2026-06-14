import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  clearBlogDomain,
  customDomainAvailable,
  getBlogDomain,
  isApexDomain,
  listPendingDomains,
  setBlogDomain,
  updateBlogDomainStatus,
  validateCustomDomain,
  wwwCounterpart,
} from "./repository";

type TestDb = NonNullable<Parameters<typeof getBlogDomain>[1]>;

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
  return drizzle(client, { schema }) as unknown as TestDb;
}

async function seed(db: TestDb, id: string, slug: string) {
  await db.insert(schema.blogs).values({
    id,
    slug,
    displayName: slug,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
}

describe("validateCustomDomain", () => {
  it("accepts and normalizes a valid hostname", () => {
    expect(validateCustomDomain("  Blog.Example.com. ")).toEqual({
      ok: true,
      domain: "blog.example.com",
    });
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "no-dot", "http://x.com", "a b.com", "-x.com"]) {
      expect(validateCustomDomain(bad)).toEqual({
        ok: false,
        reason: "invalid_format",
      });
    }
  });

  it("rejects the apex and blogbat.com subdomains as reserved", () => {
    expect(validateCustomDomain("blogbat.com").ok).toBe(false);
    expect(validateCustomDomain("acme.blogbat.com")).toEqual({
      ok: false,
      reason: "reserved",
    });
  });

  it("normalizes an IDN domain to punycode", () => {
    expect(validateCustomDomain("münchen.de")).toEqual({
      ok: true,
      domain: "xn--mnchen-3ya.de",
    });
  });
});

describe("isApexDomain / wwwCounterpart", () => {
  it("treats a 2-label host as apex", () => {
    expect(isApexDomain("example.com")).toBe(true);
    expect(wwwCounterpart("example.com")).toBe("www.example.com");
  });

  it("treats a known multi-part-TLD host as apex", () => {
    expect(isApexDomain("example.co.uk")).toBe(true);
    expect(wwwCounterpart("example.co.uk")).toBe("www.example.co.uk");
  });

  it("treats a subdomain host as not apex", () => {
    expect(isApexDomain("blog.example.com")).toBe(false);
    expect(wwwCounterpart("blog.example.com")).toBeNull();
  });
});

describe("domain repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
    await seed(db, "b1", "blog-one");
    await seed(db, "b2", "blog-two");
  });

  it("returns null fields for a blog with no domain", async () => {
    expect(await getBlogDomain("b1", db)).toEqual({
      domain: null,
      status: null,
      hostnameId: null,
      verifiedAt: null,
      lastCheckedAt: null,
      notifiedStatus: null,
      failureReason: null,
    });
  });

  it("sets a pending domain then reads it back", async () => {
    await setBlogDomain("b1", { domain: "Blog.Example.com", hostnameId: "ch_1" }, db);
    expect(await getBlogDomain("b1", db)).toEqual({
      domain: "blog.example.com",
      status: "pending",
      hostnameId: "ch_1",
      verifiedAt: null,
      lastCheckedAt: null,
      notifiedStatus: null,
      failureReason: null,
    });
  });

  it("activating stamps verifiedAt; non-active clears it", async () => {
    await setBlogDomain("b1", { domain: "x.example.com", hostnameId: "ch" }, db);
    await updateBlogDomainStatus("b1", "active", { verifiedAt: 1700000000000 }, db);
    expect(await getBlogDomain("b1", db)).toMatchObject({
      status: "active",
      verifiedAt: 1700000000000,
    });
    await updateBlogDomainStatus("b1", "failed", {}, db);
    expect(await getBlogDomain("b1", db)).toMatchObject({
      status: "failed",
      verifiedAt: null,
    });
  });

  it("customDomainAvailable ignores the blog's own domain but blocks others", async () => {
    await setBlogDomain("b1", { domain: "taken.example.com", hostnameId: "ch" }, db);
    expect(await customDomainAvailable("taken.example.com", "b2", db)).toBe(false);
    expect(await customDomainAvailable("taken.example.com", "b1", db)).toBe(true);
    expect(await customDomainAvailable("free.example.com", "b2", db)).toBe(true);
  });

  it("stores a failure reason on failed and clears it otherwise", async () => {
    await setBlogDomain("b1", { domain: "f.example.com", hostnameId: "ch" }, db);
    await updateBlogDomainStatus(
      "b1",
      "failed",
      { failureReason: "CAA records block issuance", notifiedStatus: "failed" },
      db,
    );
    expect(await getBlogDomain("b1", db)).toMatchObject({
      status: "failed",
      failureReason: "CAA records block issuance",
      notifiedStatus: "failed",
    });
    await updateBlogDomainStatus("b1", "active", {}, db);
    expect(await getBlogDomain("b1", db)).toMatchObject({
      status: "active",
      failureReason: null,
    });
  });

  it("lists only pending domains with a hostname id, least-recently-checked first", async () => {
    await setBlogDomain("b1", { domain: "a.example.com", hostnameId: "ch_a" }, db);
    await setBlogDomain("b2", { domain: "b.example.com", hostnameId: "ch_b" }, db);
    // b1 checked recently; b2 never checked → b2 sorts first.
    await updateBlogDomainStatus(
      "b1",
      "pending",
      { lastCheckedAt: 1000 },
      db,
    );
    const pending = await listPendingDomains(db);
    expect(pending.map((p) => p.blogId)).toEqual(["b2", "b1"]);
    // Activating one removes it from the pending set.
    await updateBlogDomainStatus("b1", "active", {}, db);
    const after = await listPendingDomains(db);
    expect(after.map((p) => p.blogId)).toEqual(["b2"]);
  });

  it("clears all domain fields", async () => {
    await setBlogDomain("b1", { domain: "y.example.com", hostnameId: "ch" }, db);
    await clearBlogDomain("b1", db);
    expect(await getBlogDomain("b1", db)).toEqual({
      domain: null,
      status: null,
      hostnameId: null,
      verifiedAt: null,
      lastCheckedAt: null,
      notifiedStatus: null,
      failureReason: null,
    });
  });
});
