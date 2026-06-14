CREATE TABLE `internal_link_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`keyword` text NOT NULL,
	`target_url` text NOT NULL,
	`max_per_article` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `internal_link_rules_blog_idx` ON `internal_link_rules` (`blog_id`);--> statement-breakpoint
CREATE TABLE `sitemap_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`blog_id` text DEFAULT 'default' NOT NULL,
	`url` text NOT NULL,
	`urls` text,
	`last_fetched` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sitemap_entries_blog_idx` ON `sitemap_entries` (`blog_id`);