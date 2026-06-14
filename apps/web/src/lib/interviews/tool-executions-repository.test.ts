import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import { insertToolExecution } from "./tool-executions-repository";
import type { ToolExecutionRecord } from "./tool-audit";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = NonNullable<Parameters<typeof insertToolExecution>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE tool_executions (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    interview_id text NOT NULL,
    tool_name text NOT NULL,
    call_id text,
    args_summary text NOT NULL,
    status text NOT NULL,
    error_kind text,
    duration_ms integer NOT NULL,
    cost_usd integer,
    timestamp integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX tool_executions_blog_iv_ts_idx ON tool_executions (blog_id, interview_id, timestamp);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

function listForBlog(db: TestDb, blogId: string) {
  return db
    .select()
    .from(schema.toolExecutions)
    .where(eq(schema.toolExecutions.blogId, blogId));
}

describe("tool-executions-repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("inserts a success row with all fields", async () => {
    const record: ToolExecutionRecord = {
      interviewId: "int-1",
      toolName: "add_heading",
      callId: "call-1",
      argsSummary: "add_heading {...}",
      status: "success",
      durationMs: 42,
      costUsd: null,
    };

    await insertToolExecution("blog-a", record, db);

    const rows = await listForBlog(db, "blog-a");
    expect(rows).toHaveLength(1);
    expect(rows[0].interviewId).toBe("int-1");
    expect(rows[0].toolName).toBe("add_heading");
    expect(rows[0].callId).toBe("call-1");
    expect(rows[0].argsSummary).toBe("add_heading {...}");
    expect(rows[0].status).toBe("success");
    expect(rows[0].errorKind).toBeNull();
    expect(rows[0].durationMs).toBe(42);
    expect(rows[0].costUsd).toBeNull();
    expect(typeof rows[0].timestamp).toBe("number");
    expect(rows[0].timestamp).toBeGreaterThan(0);
    expect(typeof rows[0].id).toBe("string");
  });

  it("inserts an error row with errorKind set", async () => {
    const record: ToolExecutionRecord = {
      interviewId: "int-1",
      toolName: "request_featured_image",
      callId: null,
      argsSummary: "request_featured_image {...}",
      status: "error",
      errorKind: "upstream",
      durationMs: 100,
      costUsd: 25,
    };

    await insertToolExecution("blog-a", record, db);

    const [row] = await db
      .select()
      .from(schema.toolExecutions)
      .where(
        and(
          eq(schema.toolExecutions.blogId, "blog-a"),
          eq(schema.toolExecutions.interviewId, "int-1"),
        ),
      );
    expect(row.status).toBe("error");
    expect(row.errorKind).toBe("upstream");
    expect(row.callId).toBeNull();
    expect(row.costUsd).toBe(25);
  });

  it("enforces tenant isolation — rows for blog A not visible to blog B", async () => {
    const record: ToolExecutionRecord = {
      interviewId: "int-1",
      toolName: "add_heading",
      callId: null,
      argsSummary: "add_heading {...}",
      status: "success",
      durationMs: 5,
      costUsd: null,
    };

    await insertToolExecution("blog-a", record, db);

    const fromB = await listForBlog(db, "blog-b");
    expect(fromB).toHaveLength(0);

    const fromA = await listForBlog(db, "blog-a");
    expect(fromA).toHaveLength(1);
  });
});
