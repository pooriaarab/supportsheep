import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const categories = sqliteTable(
  "categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    icon: text("icon").default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    postCount: integer("post_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("categories_blog_slug_idx").on(t.blogId, t.slug)],
);
