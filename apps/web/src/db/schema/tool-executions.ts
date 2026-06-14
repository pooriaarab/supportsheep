import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * tool_executions — one row per realtime interview tool dispatch.
 *
 * One row per dispatch (success and failure both produce a row) so admin
 * analytics queries can surface per-session tool histograms, durations, and
 * error rates without scanning the full events stream.
 *
 * `costUsd` mirrors the `interviews.costUsd` column type (integer, stored as
 * fractional cents * 10000) for consistency across the cost-tracking columns.
 * Timestamps are epoch-ms integers.
 */
export const toolExecutions = sqliteTable(
  "tool_executions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    interviewId: text("interview_id").notNull(),
    toolName: text("tool_name").notNull(),
    callId: text("call_id"), // OpenAI realtime call_id, else null
    argsSummary: text("args_summary").notNull(),
    status: text("status").notNull(), // "success" | "error"
    errorKind: text("error_kind"), // set when status === "error"
    durationMs: integer("duration_ms").notNull(),
    costUsd: integer("cost_usd"), // stored as fractional cents * 10000; null for sync tools
    timestamp: integer("timestamp").notNull(), // epoch-ms
  },
  (t) => [
    index("tool_executions_blog_iv_ts_idx").on(
      t.blogId,
      t.interviewId,
      t.timestamp,
    ),
  ],
);
