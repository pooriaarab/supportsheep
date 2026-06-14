import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const contextTags = sqliteTable(
  "context_tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    targetAudience: text("target_audience").default(""),
    tone: text("tone").default("professional"),
    style: text("style").default("informative"),
    language: text("language").default("English"),
    customPrompt: text("custom_prompt").default(""),
    // Nested objects stored as JSON-encoded TEXT
    articleLength: text("article_length"),
    cta: text("cta"),
    imageSettings: text("image_settings"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("context_tags_blog_idx").on(t.blogId)],
);
