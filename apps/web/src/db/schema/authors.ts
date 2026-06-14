import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const authors = sqliteTable(
  "authors",
  {
    pk: text("pk")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    jobTitle: text("job_title").default(""),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url").default(""),
    email: text("email").default(""),
    sameAs: text("same_as"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("authors_blog_slug_idx").on(t.blogId, t.slug)],
);
