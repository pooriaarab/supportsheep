import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { functionLogs } from "@/db/schema/function-logs";

type DB = DrizzleD1Database<typeof schema>;

export interface FunctionLogEntry {
  id: string;
  function: string;
  status: string;
  executedAt: number;
}

type Row = typeof functionLogs.$inferSelect;

function toEntry(row: Row): FunctionLogEntry {
  return {
    id: row.id,
    function: row.functionName,
    status: row.status,
    executedAt: row.executedAt,
  };
}

export async function appendFunctionLog(
  blogId: string,
  entry: { functionName: string; status: string },
  db: DB = getDb(),
): Promise<void> {
  await db.insert(functionLogs).values({
    id: nanoid(),
    blogId,
    functionName: entry.functionName,
    status: entry.status,
    executedAt: Date.now(),
  });
}

export async function listRecentFunctionLogs(
  blogId: string,
  functionName: string,
  limit: number,
  db: DB = getDb(),
): Promise<FunctionLogEntry[]> {
  const rows = await db
    .select()
    .from(functionLogs)
    .where(
      and(
        eq(functionLogs.blogId, blogId),
        eq(functionLogs.functionName, functionName),
      ),
    )
    .orderBy(desc(functionLogs.executedAt), desc(functionLogs.id))
    .limit(limit);
  return rows.map(toEntry);
}
