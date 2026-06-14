import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    userId: text("user_id").notNull(),
    type: text("type").notNull().default("info"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    actionUrl: text("action_url"),
    metadata: text("metadata"), // JSON, nullable
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("notifications_blog_user_idx").on(t.blogId, t.userId),
    index("notifications_blog_user_read_idx").on(t.blogId, t.userId, t.read),
  ],
);
