import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createInterview,
  getInterview,
  updateInterview,
  listInterviews,
  consentToLive,
  incrementResponsesCount,
} from "./interviews-repository";

type TestDb = Parameters<typeof listInterviews>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE interviews (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    status text DEFAULT 'consent' NOT NULL,
    started_by_uid text,
    started_by_role text,
    share_link_id text,
    guest_email text,
    guest_name text,
    topic text,
    goal text,
    style text DEFAULT 'smart' NOT NULL,
    recording_config text DEFAULT 'transcript' NOT NULL,
    language text DEFAULT 'en' NOT NULL,
    mode text DEFAULT 'live' NOT NULL,
    max_duration_sec integer DEFAULT 300 NOT NULL,
    canvas_snapshot text,
    canvas_snapshot_at integer,
    article_id text,
    published_direct integer,
    requires_review integer,
    ended_at integer,
    started_at integer,
    responses_count integer DEFAULT 0 NOT NULL,
    video_provider text,
    tavus_conversation_id text,
    video_storage_path text,
    cost_usd integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(`CREATE INDEX interviews_blog_idx ON interviews (blog_id);`);
  await client.execute(`CREATE INDEX interviews_blog_uid_idx ON interviews (blog_id, started_by_uid);`);
  await client.execute(`CREATE INDEX interviews_blog_status_idx ON interviews (blog_id, status);`);
  await client.execute(`CREATE INDEX interviews_blog_share_link_idx ON interviews (blog_id, share_link_id);`);
  await client.execute(`CREATE INDEX interviews_blog_created_idx ON interviews (blog_id, created_at);`);
  await client.execute(`CREATE INDEX interviews_tavus_conversation_idx ON interviews (tavus_conversation_id);`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";

describe("interviews repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listInterviews
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listInterviews(BLOG_A, {}, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // createInterview + shape
  // ---------------------------------------------------------------------------

  it("creates an interview and returns correct shape", async () => {
    const row = await createInterview(
      BLOG_A,
      {
        status: "consent",
        startedByUid: "user-1",
        startedByRole: "owner",
        style: "testimonial",
        recordingConfig: "audio",
        language: "fr",
        mode: "live",
        maxDurationSec: 600,
        topic: "My topic",
        goal: "My goal",
      },
      db,
    );

    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.blogId).toBe(BLOG_A);
    expect(row.status).toBe("consent");
    expect(row.startedByUid).toBe("user-1");
    expect(row.startedByRole).toBe("owner");
    expect(row.style).toBe("testimonial");
    expect(row.recordingConfig).toBe("audio");
    expect(row.language).toBe("fr");
    expect(row.mode).toBe("live");
    expect(row.maxDurationSec).toBe(600);
    expect(row.topic).toBe("My topic");
    expect(row.goal).toBe("My goal");
    expect(row.responsesCount).toBe(0);
    expect(typeof row.createdAt).toBe("number");
    expect(typeof row.updatedAt).toBe("number");
  });

  it("accepts a client-supplied id", async () => {
    const row = await createInterview(
      BLOG_A,
      { id: "my-fixed-id", status: "consent" },
      db,
    );
    expect(row.id).toBe("my-fixed-id");
  });

  it("create→get round-trips data", async () => {
    const created = await createInterview(
      BLOG_A,
      {
        status: "consent",
        startedByUid: "uid-1",
        style: "qa",
        topic: "Test topic",
        goal: "Test goal",
        language: "es",
      },
      db,
    );

    const fetched = await getInterview(BLOG_A, created.id, db);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.topic).toBe("Test topic");
    expect(fetched!.goal).toBe("Test goal");
    expect(fetched!.language).toBe("es");
  });

  // ---------------------------------------------------------------------------
  // getInterview
  // ---------------------------------------------------------------------------

  it("returns null for missing id", async () => {
    expect(await getInterview(BLOG_A, "nonexistent", db)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // updateInterview
  // ---------------------------------------------------------------------------

  it("updates scalar fields", async () => {
    const created = await createInterview(BLOG_A, { status: "consent" }, db);
    const updated = await updateInterview(BLOG_A, created.id, { status: "live" }, db);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("live");
  });

  it("returns null when updating non-existent id", async () => {
    const result = await updateInterview(BLOG_A, "ghost", { status: "live" }, db);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // consentToLive — status transition + idempotency
  // ---------------------------------------------------------------------------

  it("transitions consent → live", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);
    const result = await consentToLive(BLOG_A, row.id, null, db);
    expect(result.ok).toBe(true);

    const updated = await getInterview(BLOG_A, row.id, db);
    expect(updated!.status).toBe("live");
    expect(updated!.startedAt).toBeTruthy();
  });

  it("returns conflict if interview is already live", async () => {
    const row = await createInterview(BLOG_A, { status: "live" }, db);
    const result = await consentToLive(BLOG_A, row.id, null, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("conflict");
  });

  it("returns not_found if interview doesn't exist", async () => {
    const result = await consentToLive(BLOG_A, "nonexistent", null, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("idempotency guard: second concurrent consentToLive returns conflict", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);

    // First transition succeeds
    const first = await consentToLive(BLOG_A, row.id, null, db);
    expect(first.ok).toBe(true);

    // Second would-be concurrent transition sees status=live → conflict
    const second = await consentToLive(BLOG_A, row.id, null, db);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("conflict");
  });

  it("rejects consent when cost cap is exceeded", async () => {
    // Cap is $10, but we create an interview with costUsd of $11 million cents
    // (cost_usd is stored as integer; our test just checks the cap logic)
    const row = await createInterview(BLOG_A, { status: "consent" }, db);

    // Transition and set a very high cost (simulate cap exceeded by using cap=0)
    const result = await consentToLive(BLOG_A, row.id, 0, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("cost_cap_exceeded");
  });

  // ---------------------------------------------------------------------------
  // listInterviews ordering
  // ---------------------------------------------------------------------------

  it("lists newest first with id tiebreaker", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000) // first insert createdAt
      .mockReturnValueOnce(1000) // first insert updatedAt
      .mockReturnValueOnce(2000) // second insert createdAt
      .mockReturnValueOnce(2000); // second insert updatedAt

    try {
      await createInterview(BLOG_A, { status: "consent", topic: "First" }, db);
      await createInterview(BLOG_A, { status: "consent", topic: "Second" }, db);
    } finally {
      nowSpy.mockRestore();
    }

    const rows = await listInterviews(BLOG_A, {}, db);
    expect(rows[0].topic).toBe("Second");
    expect(rows[1].topic).toBe("First");
  });

  it("filters by startedByUid", async () => {
    await createInterview(BLOG_A, { status: "consent", startedByUid: "user-1" }, db);
    await createInterview(BLOG_A, { status: "consent", startedByUid: "user-2" }, db);

    const rows = await listInterviews(BLOG_A, { startedByUid: "user-1" }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].startedByUid).toBe("user-1");
  });

  // ---------------------------------------------------------------------------
  // incrementResponsesCount (atomic)
  // ---------------------------------------------------------------------------

  it("increments responsesCount atomically", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);
    expect(row.responsesCount).toBe(0);

    await incrementResponsesCount(BLOG_A, row.id, db);
    await incrementResponsesCount(BLOG_A, row.id, db);

    const updated = await getInterview(BLOG_A, row.id, db);
    expect(updated!.responsesCount).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — CRITICAL
  // ---------------------------------------------------------------------------

  it("listInterviews does not leak across blogs", async () => {
    await createInterview(BLOG_A, { status: "consent" }, db);
    expect(await listInterviews(BLOG_B, {}, db)).toEqual([]);
  });

  it("getInterview does not return another blog's interview", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);
    expect(await getInterview(BLOG_B, row.id, db)).toBeNull();
  });

  it("updateInterview does not modify another blog's interview", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);
    const result = await updateInterview(BLOG_B, row.id, { status: "live" }, db);
    expect(result).toBeNull();

    const unchanged = await getInterview(BLOG_A, row.id, db);
    expect(unchanged!.status).toBe("consent");
  });

  it("consentToLive does not affect another blog's interview", async () => {
    const row = await createInterview(BLOG_A, { status: "consent" }, db);
    const result = await consentToLive(BLOG_B, row.id, null, db);
    expect(result.ok).toBe(false);

    const unchanged = await getInterview(BLOG_A, row.id, db);
    expect(unchanged!.status).toBe("consent");
  });
});
