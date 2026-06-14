import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  appendFunctionLog,
  listRecentFunctionLogs,
} from "./function-logs-repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = NonNullable<Parameters<typeof listRecentFunctionLogs>[3]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE function_logs (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    function_name text NOT NULL,
    status text NOT NULL,
    executed_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX function_logs_blog_fn_executed_idx ON function_logs (blog_id, function_name, executed_at);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("function-logs-repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  describe("appendFunctionLog", () => {
    it("persists a log readable via listRecentFunctionLogs", async () => {
      await appendFunctionLog(
        "blog-a",
        { functionName: "scheduledPublisher", status: "manual_trigger_requested" },
        db,
      );

      const logs = await listRecentFunctionLogs(
        "blog-a",
        "scheduledPublisher",
        10,
        db,
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].function).toBe("scheduledPublisher");
      expect(logs[0].status).toBe("manual_trigger_requested");
      expect(typeof logs[0].executedAt).toBe("number");
      expect(logs[0].executedAt).toBeGreaterThan(0);
      expect(typeof logs[0].id).toBe("string");
    });
  });

  describe("listRecentFunctionLogs", () => {
    it("returns an empty array when no logs exist", async () => {
      const logs = await listRecentFunctionLogs("blog-a", "seoMonitor", 10, db);
      expect(logs).toEqual([]);
    });

    it("only returns logs for the requested function", async () => {
      await appendFunctionLog(
        "blog-a",
        { functionName: "scheduledPublisher", status: "ok" },
        db,
      );
      await appendFunctionLog(
        "blog-a",
        { functionName: "seoMonitor", status: "ok" },
        db,
      );

      const logs = await listRecentFunctionLogs(
        "blog-a",
        "scheduledPublisher",
        10,
        db,
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].function).toBe("scheduledPublisher");
    });

    it("orders by executedAt desc (newest first) with id tiebreaker", async () => {
      // Insert rows with explicit, controlled timestamps including a tie.
      await db.insert(schema.functionLogs).values([
        {
          id: "a",
          blogId: "blog-a",
          functionName: "fn",
          status: "old",
          executedAt: 100,
        },
        {
          id: "z",
          blogId: "blog-a",
          functionName: "fn",
          status: "tie-z",
          executedAt: 200,
        },
        {
          id: "b",
          blogId: "blog-a",
          functionName: "fn",
          status: "tie-b",
          executedAt: 200,
        },
      ]);

      const logs = await listRecentFunctionLogs("blog-a", "fn", 10, db);
      expect(logs.map((l) => l.id)).toEqual(["z", "b", "a"]);
    });

    it("respects the limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await appendFunctionLog(
          "blog-a",
          { functionName: "fn", status: `s${i}` },
          db,
        );
      }
      const logs = await listRecentFunctionLogs("blog-a", "fn", 3, db);
      expect(logs).toHaveLength(3);
    });

    it("enforces tenant isolation — rows for blog A not visible to blog B", async () => {
      await appendFunctionLog("blog-a", { functionName: "fn", status: "ok" }, db);

      const fromB = await listRecentFunctionLogs("blog-b", "fn", 10, db);
      expect(fromB).toEqual([]);

      const fromA = await listRecentFunctionLogs("blog-a", "fn", 10, db);
      expect(fromA).toHaveLength(1);
    });
  });
});
