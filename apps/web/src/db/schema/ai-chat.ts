import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const aiChatThreads = sqliteTable(
  "ai_chat_threads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull(),
    userId: text("user_id").notNull(),
    title: text("title"),
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [index("ai_chat_threads_blog_user_idx").on(t.blogId, t.userId)],
);

export const aiChatMessages = sqliteTable(
  "ai_chat_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [index("ai_chat_messages_blog_thread_idx").on(t.blogId, t.threadId)],
);

/**
 * Singleton per-blog AI chat settings (model, temperature, maxTokens, systemPrompt).
 * Starts empty — getAiChatSettings() returns code defaults when absent.
 */
export const aiChatSettings = sqliteTable("ai_chat_settings", {
  blogId: text("blog_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(), // epoch-ms
});
