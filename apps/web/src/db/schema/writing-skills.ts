import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const writingSkills = sqliteTable(
  "writing_skills",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    type: text("type").notNull().default("custom"),
    description: text("description").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    provider: text("provider").notNull().default("claude"),
    model: text("model").notNull().default(""),
    order: integer("order").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("writing_skills_blog_idx").on(t.blogId)],
);
