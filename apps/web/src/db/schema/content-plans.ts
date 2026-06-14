import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * content_plans — AI-generated keyword content calendars.
 *
 * The `posts` column stores a JSON array of ContentPlanPost objects (keyword,
 * postType, scheduledDate, status, articleSlug, contextTagId).
 * Timestamps are stored as epoch-ms integers.
 */
export const contentPlans = sqliteTable(
  "content_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    posts: text("posts").notNull().default("[]"), // JSON: ContentPlanPost[]
    provider: text("provider").notNull().default("claude"),
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("content_plans_blog_idx").on(t.blogId),
    index("content_plans_blog_created_idx").on(t.blogId, t.createdAt),
  ],
);
