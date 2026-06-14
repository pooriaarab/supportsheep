import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import type { CustomHostnameResult } from "./cloudflare-saas";

const getCustomHostnameMock = vi.fn<(id: string) => Promise<CustomHostnameResult>>();
const sendActivatedMock = vi.fn<() => Promise<void>>();
const sendFailedMock = vi.fn<() => Promise<void>>();

vi.mock("./cloudflare-saas", () => ({
  getCustomHostname: (id: string) => getCustomHostnameMock(id),
}));

vi.mock("./send-domain-status-email", () => ({
  sendDomainActivatedEmail: () => sendActivatedMock(),
  sendDomainFailedEmail: () => sendFailedMock(),
}));

import { refreshAllPendingDomains, refreshDomainStatus } from "./refresh";
import { getBlogDomain, setBlogDomain, updateBlogDomainStatus } from "./repository";

type TestDb = NonNullable<Parameters<typeof getBlogDomain>[1]>;

function hostname(over: Partial<CustomHostnameResult>): CustomHostnameResult {
  return {
    id: "ch_1",
    hostname: "blog.example.com",
    status: "pending",
    sslStatus: "pending_validation",
    sslValidationErrors: [],
    verificationErrors: [],
    dcvTarget: "blogbat.com",
    ownershipVerification: null,
    ...over,
  };
}

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

async function seedPending(db: TestDb, id: string, slug: string) {
  await db.insert(schema.blogs).values({
    id,
    slug,
    displayName: slug,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  await setBlogDomain(id, { domain: `${slug}.example.com`, hostnameId: `ch_${id}` }, db);
}

describe("refreshDomainStatus", () => {
  let db!: TestDb;
  beforeEach(async () => {
    vi.clearAllMocks();
    db = await makeDb();
    await seedPending(db, "b1", "blogone");
  });

  it("activates a domain and sends one activation email", async () => {
    getCustomHostnameMock.mockResolvedValue(
      hostname({ status: "active", sslStatus: "active" }),
    );
    const outcome = await refreshDomainStatus(
      {
        blogId: "b1",
        hostnameId: "ch_b1",
        currentStatus: "pending",
        notifiedStatus: null,
        pendingSince: null,
        now: 5000,
      },
      db,
    );
    expect(outcome.status).toBe("active");
    expect(outcome.changed).toBe(true);
    expect(sendActivatedMock).toHaveBeenCalledTimes(1);
    const stored = await getBlogDomain("b1", db);
    expect(stored).toMatchObject({
      status: "active",
      verifiedAt: 5000,
      notifiedStatus: "active",
      lastCheckedAt: 5000,
    });
  });

  it("does not re-email a transition already notified", async () => {
    await updateBlogDomainStatus("b1", "active", { notifiedStatus: "active" }, db);
    // Put it back to pending in our call args but keep notifiedStatus=active.
    getCustomHostnameMock.mockResolvedValue(
      hostname({ status: "active", sslStatus: "active" }),
    );
    await refreshDomainStatus(
      {
        blogId: "b1",
        hostnameId: "ch_b1",
        currentStatus: "pending",
        notifiedStatus: "active",
        pendingSince: null,
      },
      db,
    );
    expect(sendActivatedMock).not.toHaveBeenCalled();
  });

  it("marks failed with a reason and emails on a CAA error", async () => {
    getCustomHostnameMock.mockResolvedValue(
      hostname({ sslValidationErrors: ["caa_error blocks issuance"] }),
    );
    const outcome = await refreshDomainStatus(
      {
        blogId: "b1",
        hostnameId: "ch_b1",
        currentStatus: "pending",
        notifiedStatus: null,
        pendingSince: null,
      },
      db,
    );
    expect(outcome.status).toBe("failed");
    expect(sendFailedMock).toHaveBeenCalledTimes(1);
    const stored = await getBlogDomain("b1", db);
    expect(stored?.failureReason?.toLowerCase()).toContain("caa");
  });

  it("times out a long-pending domain to failed", async () => {
    getCustomHostnameMock.mockResolvedValue(hostname({}));
    const dayMs = 24 * 60 * 60 * 1000;
    const outcome = await refreshDomainStatus(
      {
        blogId: "b1",
        hostnameId: "ch_b1",
        currentStatus: "pending",
        notifiedStatus: null,
        pendingSince: 0,
        now: dayMs + 1,
      },
      db,
    );
    expect(outcome.status).toBe("failed");
    expect(sendFailedMock).toHaveBeenCalledTimes(1);
  });

  it("stays pending while DCV is still validating", async () => {
    getCustomHostnameMock.mockResolvedValue(hostname({}));
    const outcome = await refreshDomainStatus(
      {
        blogId: "b1",
        hostnameId: "ch_b1",
        currentStatus: "pending",
        notifiedStatus: null,
        pendingSince: Date.now(),
      },
      db,
    );
    expect(outcome.status).toBe("pending");
    expect(sendActivatedMock).not.toHaveBeenCalled();
    expect(sendFailedMock).not.toHaveBeenCalled();
  });
});

describe("refreshAllPendingDomains", () => {
  let db!: TestDb;
  beforeEach(async () => {
    vi.clearAllMocks();
    db = await makeDb();
    await seedPending(db, "b1", "blogone");
    await seedPending(db, "b2", "blogtwo");
  });

  it("advances every pending domain and reports counts", async () => {
    getCustomHostnameMock.mockResolvedValue(
      hostname({ status: "active", sslStatus: "active" }),
    );
    const result = await refreshAllPendingDomains({ now: 1000 }, db);
    expect(result.scanned).toBe(2);
    expect(result.checked).toBe(2);
    expect(result.activated).toBe(2);
    expect(sendActivatedMock).toHaveBeenCalledTimes(2);
  });

  it("skips a domain checked within the backoff window", async () => {
    await updateBlogDomainStatus("b1", "pending", { lastCheckedAt: 990 }, db);
    getCustomHostnameMock.mockResolvedValue(
      hostname({ status: "active", sslStatus: "active" }),
    );
    const result = await refreshAllPendingDomains(
      { now: 1000, minRecheckMs: 60_000 },
      db,
    );
    // b1 was checked 10ms ago (< 60s) → skipped; only b2 is checked.
    expect(result.checked).toBe(1);
  });

  it("continues past a domain whose Cloudflare lookup throws", async () => {
    getCustomHostnameMock
      .mockRejectedValueOnce(new Error("cf down"))
      .mockResolvedValue(hostname({ status: "active", sslStatus: "active" }));
    const result = await refreshAllPendingDomains({ now: 1000 }, db);
    // One throws (not counted as checked), one succeeds.
    expect(result.checked).toBe(1);
    expect(result.activated).toBe(1);
  });
});
