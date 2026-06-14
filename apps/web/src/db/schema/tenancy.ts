import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "./auth";

/**
 * A tenant. Public requests will resolve to a blog by hostname
 * ({slug}.blogbat.com or a mapped custom_domain) in a later slice; the
 * dashboard/API path resolves via blog_members (see lib/tenancy/repository).
 */
export const blogs = sqliteTable("blogs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain").unique(),
  /**
   * Verification state of the self-serve custom domain:
   * - "pending": a Cloudflare for SaaS custom hostname was created; the owner
   *   must add the CNAME and Cloudflare must validate the certificate.
   * - "active": validated and serving — `getBlogByVerifiedCustomDomain` resolves it.
   * - "failed": validation failed/blocked.
   * Null when no custom domain is configured.
   */
  customDomainStatus: text("custom_domain_status"),
  /** Cloudflare for SaaS `custom_hostname` id, used for status polling + deletion. */
  customDomainHostnameId: text("custom_domain_hostname_id"),
  /** Epoch-ms when the custom domain first became active, or null. */
  customDomainVerifiedAt: integer("custom_domain_verified_at"),
  /**
   * Epoch-ms of the last Cloudflare status refresh for this domain. Drives the
   * background poller's backoff: rows checked recently are skipped on a run, so
   * a freshly-added domain is polled every run while an older one is polled less
   * often. Null when never checked.
   */
  customDomainLastCheckedAt: integer("custom_domain_last_checked_at"),
  /**
   * The status we last sent a transition email for ("active" | "failed"). Used
   * to dedupe notifications so owners are emailed exactly once per transition —
   * the poller/GET refresh only sends when the new status differs from this.
   */
  customDomainNotifiedStatus: text("custom_domain_notified_status"),
  /**
   * Plain-English reason a custom domain failed (mapped from the Cloudflare
   * SSL/hostname error), stored so the dashboard and emails can explain the fix
   * without re-querying Cloudflare. Null unless failed.
   */
  customDomainFailureReason: text("custom_domain_failure_reason"),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Membership of a user in a blog, with their per-blog role. */
export const blogMembers = sqliteTable(
  "blog_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // owner > admin > editor > viewer (see roleSatisfies in api-utils).
    role: text("role").notNull().default("viewer"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex("blog_members_blog_user_idx").on(t.blogId, t.userId),
    index("blog_members_user_idx").on(t.userId),
  ],
);
