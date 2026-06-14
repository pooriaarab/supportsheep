import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { auditLogs } from "@/db/schema/audit-log";

import { getClientIp, logAuditEvent } from "./audit-log";

type TestDb = NonNullable<Parameters<typeof logAuditEvent>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE audit_logs (
    id text PRIMARY KEY NOT NULL,
    actor_id text NOT NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    metadata text DEFAULT '{}',
    ip text,
    result text NOT NULL,
    error_message text,
    created_at text NOT NULL
  );`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("logAuditEvent (D1)", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("persists an audit event and returns its id", async () => {
    const id = await logAuditEvent(
      {
        actorId: "u1",
        actorEmail: "u1@example.com",
        action: "create_category",
        targetType: "item",
        targetId: "news",
        metadata: { foo: "bar" },
        ip: "1.2.3.4",
        result: "success",
      },
      db,
    );
    expect(id).not.toBe("");

    const rows = await db.select().from(auditLogs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        actorId: "u1",
        actorEmail: "u1@example.com",
        action: "create_category",
        targetType: "item",
        targetId: "news",
        metadata: { foo: "bar" },
        ip: "1.2.3.4",
        result: "success",
      }),
    );
    expect(typeof rows[0].createdAt).toBe("string");
  });

  it("never throws on a DB error (returns empty string)", async () => {
    const broken = {
      insert: () => {
        throw new Error("db down");
      },
    } as unknown as TestDb;
    const id = await logAuditEvent(
      { actorId: "u1", actorEmail: "u1@example.com", action: "login", result: "success" },
      broken,
    );
    expect(id).toBe("");
  });
});

describe("getClientIp", () => {
  function reqWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  it("prefers cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
    const ip = getClientIp(
      reqWith({
        "cf-connecting-ip": "9.9.9.9",
        "x-real-ip": "8.8.8.8",
        "x-forwarded-for": "7.7.7.7, 1.1.1.1",
      }),
    );
    expect(ip).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when cf-connecting-ip is absent", () => {
    const ip = getClientIp(
      reqWith({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "7.7.7.7" }),
    );
    expect(ip).toBe("8.8.8.8");
  });

  it("falls back to the first hop of x-forwarded-for as a last resort", () => {
    const ip = getClientIp(reqWith({ "x-forwarded-for": "7.7.7.7, 1.1.1.1" }));
    expect(ip).toBe("7.7.7.7");
  });

  it("returns null when no IP headers are present", () => {
    expect(getClientIp(reqWith({}))).toBeNull();
  });
});
