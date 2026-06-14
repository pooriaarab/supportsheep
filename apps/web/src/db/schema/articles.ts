import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const articles = sqliteTable(
  "articles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("draft"),
    category: text("category"),
    primaryCategory: text("primary_category"),
    postType: text("post_type"),
    authorId: text("author_id"),
    publishedAt: text("published_at"),
    scheduledAt: text("scheduled_at"),
    wordCount: integer("word_count"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    /** Full Article object as JSON — source of truth on read. */
    data: text("data").notNull(),
  },
  (t) => [
    uniqueIndex("articles_blog_slug_idx").on(t.blogId, t.slug),
    index("articles_blog_status_idx").on(t.blogId, t.status),
    index("articles_blog_updated_idx").on(t.blogId, t.updatedAt),
  ],
);
