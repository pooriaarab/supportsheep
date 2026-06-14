import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  RESERVED_SUBDOMAINS,
  getBlogByCustomDomain,
  getBlogBySlug,
  isMarketingHost,
  isPlatformHost,
  isTenantSubdomainHost,
  resolveBlogIdByHost,
} from "./host-resolution";

// Real in-memory SQLite so drizzle queries actually execute against the
// `blogs` table (slug + custom_domain are unique-indexed).
type TestDb = NonNullable<Parameters<typeof resolveBlogIdByHost>[1]>;

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

async function seedBlog(
  db: TestDb,
  row: {
    id: string;
    slug: string;
    customDomain?: string;
    customDomainStatus?: "pending" | "active" | "failed";
    displayName: string;
  },
) {
  await db.insert(schema.blogs).values({
    id: row.id,
    slug: row.slug,
    customDomain: row.customDomain ?? null,
    // A custom domain is only served when verified; default seeded domains to
    // "active" so existing routing assertions hold.
    customDomainStatus: row.customDomain
      ? (row.customDomainStatus ?? "active")
      : null,
    displayName: row.displayName,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
}

describe("getBlogBySlug / getBlogByCustomDomain", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
    await seedBlog(db, {
      id: "b-acme",
      slug: "acme",
      customDomain: "blog.acme.com",
      displayName: "Acme",
    });
  });

  it("resolves a blog by slug (lowercased)", async () => {
    expect(await getBlogBySlug("acme", db)).toEqual({
      id: "b-acme",
      slug: "acme",
      displayName: "Acme",
    });
    expect(await getBlogBySlug("ACME", db)).toEqual({
      id: "b-acme",
      slug: "acme",
      displayName: "Acme",
    });
  });

  it("returns null for an unknown slug", async () => {
    expect(await getBlogBySlug("nope", db)).toBeNull();
  });

  it("resolves a blog by custom domain (lowercased)", async () => {
    expect(await getBlogByCustomDomain("blog.acme.com", db)).toEqual({
      id: "b-acme",
      slug: "acme",
      displayName: "Acme",
    });
    expect(await getBlogByCustomDomain("BLOG.ACME.COM", db)).toEqual({
      id: "b-acme",
      slug: "acme",
      displayName: "Acme",
    });
  });

  it("returns null for an unmapped custom domain", async () => {
    expect(await getBlogByCustomDomain("other.example.com", db)).toBeNull();
  });

  it("does NOT resolve a custom domain that is still pending", async () => {
    await seedBlog(db, {
      id: "b-pending",
      slug: "pending-blog",
      customDomain: "pending.example.com",
      customDomainStatus: "pending",
      displayName: "Pending",
    });
    expect(await getBlogByCustomDomain("pending.example.com", db)).toBeNull();
  });

  it("does NOT resolve a custom domain whose verification failed", async () => {
    await seedBlog(db, {
      id: "b-failed",
      slug: "failed-blog",
      customDomain: "failed.example.com",
      customDomainStatus: "failed",
      displayName: "Failed",
    });
    expect(await getBlogByCustomDomain("failed.example.com", db)).toBeNull();
  });
});

describe("resolveBlogIdByHost", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
    await seedBlog(db, {
      id: "b-acme",
      slug: "acme",
      customDomain: "blog.acme.com",
      displayName: "Acme",
    });
  });

  it("resolves a {slug}.blogbat.com subdomain to its blog id", async () => {
    expect(await resolveBlogIdByHost("acme.blogbat.com", db)).toBe("b-acme");
  });

  it("strips the port and lowercases the host", async () => {
    expect(await resolveBlogIdByHost("ACME.blogbat.com:443", db)).toBe(
      "b-acme",
    );
  });

  it("returns null for an unknown subdomain slug", async () => {
    expect(await resolveBlogIdByHost("ghost.blogbat.com", db)).toBeNull();
  });

  it("returns null for the apex domain (reserved for marketing)", async () => {
    expect(await resolveBlogIdByHost("blogbat.com", db)).toBeNull();
  });

  it("returns null for every reserved subdomain", async () => {
    for (const sub of RESERVED_SUBDOMAINS) {
      expect(await resolveBlogIdByHost(`${sub}.blogbat.com`, db)).toBeNull();
    }
  });

  it("returns null for the staging host itself", async () => {
    expect(await resolveBlogIdByHost("staging.blogbat.com", db)).toBeNull();
  });

  it("resolves a {slug}.staging.blogbat.com subdomain by its left-most label", async () => {
    expect(await resolveBlogIdByHost("acme.staging.blogbat.com", db)).toBe(
      "b-acme",
    );
  });

  it("resolves a custom domain (non-blogbat.com host) to its blog id", async () => {
    expect(await resolveBlogIdByHost("blog.acme.com", db)).toBe("b-acme");
  });

  it("returns null for an unmapped custom domain", async () => {
    expect(await resolveBlogIdByHost("unknown.example.com", db)).toBeNull();
  });

  it("returns null for an empty host", async () => {
    expect(await resolveBlogIdByHost("", db)).toBeNull();
  });
});

describe("isMarketingHost", () => {
  it("marks the apex domain as marketing", () => {
    expect(isMarketingHost("blogbat.com")).toBe(true);
  });

  it("marks the www host as marketing", () => {
    expect(isMarketingHost("www.blogbat.com")).toBe(true);
  });

  it("strips the port and lowercases before matching", () => {
    expect(isMarketingHost("BlogBat.com:443")).toBe(true);
    expect(isMarketingHost("WWW.BLOGBAT.COM:8080")).toBe(true);
  });

  it("marks local-dev apex hosts as marketing", () => {
    expect(isMarketingHost("localhost")).toBe(true);
    expect(isMarketingHost("localhost:3000")).toBe(true);
    expect(isMarketingHost("127.0.0.1")).toBe(true);
  });

  it("does NOT mark tenant subdomains as marketing", () => {
    expect(isMarketingHost("acme.blogbat.com")).toBe(false);
    expect(isMarketingHost("ghost.blogbat.com")).toBe(false);
  });

  it("does NOT mark platform surfaces as marketing", () => {
    expect(isMarketingHost("app.blogbat.com")).toBe(false);
    expect(isMarketingHost("api.blogbat.com")).toBe(false);
    expect(isMarketingHost("admin.blogbat.com")).toBe(false);
  });

  it("marks the staging apex as marketing (staging mirror of the apex)", () => {
    expect(isMarketingHost("staging.blogbat.com")).toBe(true);
    expect(isMarketingHost("STAGING.BLOGBAT.COM:443")).toBe(true);
  });

  it("does NOT mark staging tenant subdomains as marketing", () => {
    expect(isMarketingHost("acme.staging.blogbat.com")).toBe(false);
  });

  it("does NOT mark custom domains as marketing", () => {
    expect(isMarketingHost("blog.acme.com")).toBe(false);
    expect(isMarketingHost("example.com")).toBe(false);
  });

  it("returns false for an empty host", () => {
    expect(isMarketingHost("")).toBe(false);
  });
});

describe("isPlatformHost", () => {
  it("marks the apex and any *.blogbat.com host as first-party", () => {
    expect(isPlatformHost("blogbat.com")).toBe(true);
    expect(isPlatformHost("www.blogbat.com")).toBe(true);
    expect(isPlatformHost("app.blogbat.com")).toBe(true);
    expect(isPlatformHost("acme.blogbat.com")).toBe(true);
    expect(isPlatformHost("customers.blogbat.com")).toBe(true);
    expect(isPlatformHost("acme.staging.blogbat.com")).toBe(true);
    expect(isPlatformHost("ACME.BLOGBAT.COM:443")).toBe(true);
  });

  it("marks local-dev apex hosts as first-party", () => {
    expect(isPlatformHost("localhost")).toBe(true);
    expect(isPlatformHost("localhost:3000")).toBe(true);
    expect(isPlatformHost("127.0.0.1")).toBe(true);
  });

  it("does NOT mark foreign custom domains as first-party", () => {
    expect(isPlatformHost("blog.acme.com")).toBe(false);
    expect(isPlatformHost("blog.solozilla.com")).toBe(false);
    expect(isPlatformHost("example.com")).toBe(false);
  });

  it("returns false for an empty host", () => {
    expect(isPlatformHost("")).toBe(false);
  });
});

describe("isTenantSubdomainHost", () => {
  it("marks a non-reserved *.blogbat.com host as a tenant subdomain", () => {
    expect(isTenantSubdomainHost("acme.blogbat.com")).toBe(true);
    expect(isTenantSubdomainHost("ACME.BLOGBAT.COM:443")).toBe(true);
    expect(isTenantSubdomainHost("acme.staging.blogbat.com")).toBe(true);
  });

  it("does NOT mark the apex or reserved subdomains as tenant subdomains", () => {
    expect(isTenantSubdomainHost("blogbat.com")).toBe(false);
    expect(isTenantSubdomainHost("www.blogbat.com")).toBe(false);
    expect(isTenantSubdomainHost("app.blogbat.com")).toBe(false);
    expect(isTenantSubdomainHost("staging.blogbat.com")).toBe(false);
  });

  it("exempts the SaaS fallback-origin host (customers.blogbat.com)", () => {
    // The Cloudflare-for-SaaS fallback origin must never hit the unknown-
    // subdomain 404 path — it is a reserved platform host.
    expect(isTenantSubdomainHost("customers.blogbat.com")).toBe(false);
  });

  it("does NOT mark non-blogbat custom domains as tenant subdomains", () => {
    expect(isTenantSubdomainHost("blog.acme.com")).toBe(false);
    expect(isTenantSubdomainHost("example.com")).toBe(false);
  });

  it("returns false for an empty host", () => {
    expect(isTenantSubdomainHost("")).toBe(false);
  });
});
