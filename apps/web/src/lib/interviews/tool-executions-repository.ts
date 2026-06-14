import "server-only";

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { toolExecutions } from "@/db/schema/tool-executions";
import type { ToolExecutionRecord } from "./tool-audit";

type DB = DrizzleD1Database<typeof schema>;

/**
 * Persist a single tool-execution audit row. The caller (`recordToolExecution`)
 * owns the fire-and-forget try/catch, so this throws on failure.
 */
export async function insertToolExecution(
  blogId: string,
  record: ToolExecutionRecord,
  db: DB = getDb(),
): Promise<void> {
  await db.insert(toolExecutions).values({
    id: nanoid(),
    blogId,
    interviewId: record.interviewId,
    toolName: record.toolName,
    callId: record.callId,
    argsSummary: record.argsSummary,
    status: record.status,
    errorKind: record.errorKind ?? null,
    durationMs: record.durationMs,
    costUsd: record.costUsd ?? null,
    timestamp: Date.now(),
  });
}
