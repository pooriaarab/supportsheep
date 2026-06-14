import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const templates = sqliteTable(
  "templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    fields: integer("fields").notNull().default(0),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [index("templates_blog_idx").on(t.blogId)],
);
