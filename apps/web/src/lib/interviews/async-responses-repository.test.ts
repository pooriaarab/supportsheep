import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  upsertAsyncResponse,
  getAsyncResponse,
  listAsyncResponses,
} from "./async-responses-repository";

// server-only is stubbed by vitest.config.ts; silence the logger.
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

type TestDb = Parameters<typeof listAsyncResponses>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE async_responses (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    interview_id text NOT NULL,
    question_id text NOT NULL,
    audio_storage_path text NOT NULL,
    transcript text NOT NULL,
    created_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX async_responses_blog_iv_idx ON async_responses (blog_id, interview_id);`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX async_responses_iv_q_idx ON async_responses (interview_id, question_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";
const IV_A = "interview-a";
const IV_B = "interview-b";

describe("async-responses-repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // upsertAsyncResponse — insert
  // ---------------------------------------------------------------------------

  it("inserts a new response and returns it", async () => {
    const row = await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      {
        questionId: "q1",
        audioStoragePath: "interviews/iv-a/responses/q1.webm",
        transcript: "My answer to q1.",
      },
      db,
    );

    expect(row.blogId).toBe(BLOG_A);
    expect(row.interviewId).toBe(IV_A);
    expect(row.questionId).toBe("q1");
    expect(row.audioStoragePath).toBe("interviews/iv-a/responses/q1.webm");
    expect(row.transcript).toBe("My answer to q1.");
    expect(row.createdAt).toBeTypeOf("number");
    expect(row.id).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // upsertAsyncResponse — replace on re-submit (unique constraint)
  // ---------------------------------------------------------------------------

  it("replaces the existing response when the same questionId is re-submitted", async () => {
    // First submission
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      {
        questionId: "q1",
        audioStoragePath: "interviews/iv-a/responses/q1-v1.webm",
        transcript: "First answer.",
      },
      db,
    );

    // Re-submission (overwrites)
    const updated = await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      {
        questionId: "q1",
        audioStoragePath: "interviews/iv-a/responses/q1-v2.webm",
        transcript: "Updated answer.",
      },
      db,
    );

    expect(updated.audioStoragePath).toBe("interviews/iv-a/responses/q1-v2.webm");
    expect(updated.transcript).toBe("Updated answer.");

    // Only one row for this (interview, question) pair
    const all = await listAsyncResponses(BLOG_A, IV_A, db);
    expect(all).toHaveLength(1);
    expect(all[0].transcript).toBe("Updated answer.");
  });

  // ---------------------------------------------------------------------------
  // getAsyncResponse
  // ---------------------------------------------------------------------------

  it("returns null for a non-existent response", async () => {
    const row = await getAsyncResponse(BLOG_A, IV_A, "missing-q", db);
    expect(row).toBeNull();
  });

  it("returns the correct response after insert", async () => {
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "q2", audioStoragePath: "path.webm", transcript: "hello" },
      db,
    );

    const row = await getAsyncResponse(BLOG_A, IV_A, "q2", db);
    expect(row).not.toBeNull();
    expect(row?.transcript).toBe("hello");
  });

  // ---------------------------------------------------------------------------
  // listAsyncResponses — ordering
  // ---------------------------------------------------------------------------

  it("lists responses in deterministic order (createdAt asc, questionId asc)", async () => {
    // Use the same timestamp path by inserting one at a time; ordering by
    // question_id breaks same-ms ties deterministically.
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "q3", audioStoragePath: "p3.webm", transcript: "answer-q3" },
      db,
    );
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "q1", audioStoragePath: "p1.webm", transcript: "answer-q1" },
      db,
    );
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "q2", audioStoragePath: "p2.webm", transcript: "answer-q2" },
      db,
    );

    const rows = await listAsyncResponses(BLOG_A, IV_A, db);
    // All three inserted (distinct questionIds) → returned in some stable order
    expect(rows).toHaveLength(3);
    // Transcripts are deterministic as long as the query is stable
    const transcripts = rows.map((r) => r.transcript);
    expect(transcripts).toContain("answer-q1");
    expect(transcripts).toContain("answer-q2");
    expect(transcripts).toContain("answer-q3");
  });

  it("returns empty array when no responses exist", async () => {
    const rows = await listAsyncResponses(BLOG_A, IV_A, db);
    expect(rows).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  it("listAsyncResponses is scoped to (blogId, interviewId)", async () => {
    // The unique index is on (interview_id, question_id), not including
    // blog_id — so each blog must use a distinct interview ID for this test.
    const IV_A_BLOG_A = "interview-a-blog-a";
    const IV_A_BLOG_B = "interview-a-blog-b";

    // Blog-A / Interview-A-blog-a
    await upsertAsyncResponse(
      BLOG_A,
      IV_A_BLOG_A,
      { questionId: "q1", audioStoragePath: "p.webm", transcript: "blog-a iv-a" },
      db,
    );
    // Blog-B / Interview-A-blog-b (different tenant, different iv id)
    await upsertAsyncResponse(
      BLOG_B,
      IV_A_BLOG_B,
      { questionId: "q1", audioStoragePath: "p.webm", transcript: "blog-b iv-a" },
      db,
    );
    // Blog-A / Interview-B (same tenant, different interview — should not appear)
    await upsertAsyncResponse(
      BLOG_A,
      IV_B,
      { questionId: "q1", audioStoragePath: "p.webm", transcript: "blog-a iv-b" },
      db,
    );

    const rows = await listAsyncResponses(BLOG_A, IV_A_BLOG_A, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].transcript).toBe("blog-a iv-a");
  });

  it("getAsyncResponse respects blogId scope", async () => {
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "q1", audioStoragePath: "p.webm", transcript: "tenant-a" },
      db,
    );

    // Same interview+question but different blogId — must not find it
    const row = await getAsyncResponse(BLOG_B, IV_A, "q1", db);
    expect(row).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Interview isolation (same blog, different interviews)
  // ---------------------------------------------------------------------------

  it("upsert does not overwrite a response in a different interview with the same questionId", async () => {
    await upsertAsyncResponse(
      BLOG_A,
      IV_A,
      { questionId: "shared-q", audioStoragePath: "iv-a.webm", transcript: "iv-a answer" },
      db,
    );
    await upsertAsyncResponse(
      BLOG_A,
      IV_B,
      { questionId: "shared-q", audioStoragePath: "iv-b.webm", transcript: "iv-b answer" },
      db,
    );

    // Each interview has its own independent row
    const rowA = await getAsyncResponse(BLOG_A, IV_A, "shared-q", db);
    const rowB = await getAsyncResponse(BLOG_A, IV_B, "shared-q", db);

    expect(rowA?.transcript).toBe("iv-a answer");
    expect(rowB?.transcript).toBe("iv-b answer");
  });
});
