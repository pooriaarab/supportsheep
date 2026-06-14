import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * function_logs — one row per Cloud Function run/trigger event.
 *
 * Powers the functions dashboard (`/api/v1/functions`): the GET handler reads
 * the most recent N logs per function ordered by `executedAt desc` to derive
 * each function's last run time and status.
 *
 * `functionName` maps to the legacy Firestore `function` field (renamed here to
 * avoid the JS reserved word in the column object key). Timestamps are epoch-ms
 * integers.
 */
export const functionLogs = sqliteTable(
  "function_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    functionName: text("function_name").notNull(),
    status: text("status").notNull(),
    executedAt: integer("executed_at").notNull(), // epoch-ms
  },
  (t) => [
    index("function_logs_blog_fn_executed_idx").on(
      t.blogId,
      t.functionName,
      t.executedAt,
    ),
  ],
);
